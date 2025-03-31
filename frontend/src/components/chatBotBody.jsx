import React, { use, useRef, useState, useEffect } from "react";
import {Fab, Input, TextareaAutosize} from "@mui/material";
import "react-chat-elements/dist/main.css"
import {Formik, Form, Field} from "formik";
import {RequestService, RequestUrlService} from "./request";
import parse from 'html-react-parser';
import * as yup from "yup";
import {MessageList, Avatar} from "react-chat-elements";
import UploadOutlinedIcon from '@mui/icons-material/UploadOutlined';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import { Button, CircularProgress } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import Backdrop from '@mui/material/Backdrop';
import Modal from '@mui/material/Modal';
import Box from '@mui/material/Box';
import Snackbar from "@mui/material/Snackbar";

const formValidationSchema = yup.object().shape({
    inputmessage: yup.string().required("Messgaes is Required"),
    youTubeUrl: yup.string().required("Url Type is Required")
});

export default function ChatBotBody () {
    const style = {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 650,
        bgcolor: 'background.paper',
        border: '2px solid #000',
        boxShadow: 24,
        p: 4,
      };
    const [size, setSize] = useState(window.innerWidth);
    const [messages, setMessages] = useState([]);
    const [url, setUrl] = useState("");
    const [embedUrl, setembedUrl] = useState("");
    const [videoProcessed, setVideoProcessed] = useState(false);
    const [isDisabled, setIsDisabled] = useState(false);
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const heightRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [alertOpen, setAlertOpen] = useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    const updateHeight = () => {
        if (heightRef.current) {
            heightRef.current.scrollTop = heightRef.current.scrollHeight;
        }
    };
    useEffect(() => {
        const resizeObserver = new ResizeObserver(() => {
            setSize(window.innerWidth);
        });

        resizeObserver.observe(document.body);

        return () => resizeObserver.disconnect();
    }, []);
    
      // Recalculate the height whenever messages change
    useEffect(() => {
        updateHeight();
    }, [messages]);
    
    const submitVideoId = () => {
        setIsLoading(true)
        const response = RequestUrlService("/videoUrlProcessing", {"url": url});
        response.then((res)=>{
            if (res.detail.status == true){
                setMessages((prevMsg)=>
                    [...prevMsg, {
                        position: "left",
                        type: "text",
                        title: "Bot",
                        text: "Hi, How can i help you! I can assist you!",
                        focus: true,
                        avatar: "https://t4.ftcdn.net/jpg/02/11/61/95/360_F_211619589_fnRk5LeZohVD1hWInMAQkWzAdyVlS5ox.jpg",
                        className: "text-black max-h-screen font-semibold font-mono",
                        date: new Date(),
                        statusTitle: "Received",
                        status: "received"
                    }])
                setembedUrl(`https://www.youtube.com/embed/${url.split('?')[1]}`)
                setVideoProcessed(true)
                setIsDisabled(true)
                setIsError(false)
            } else {
                setIsError(true)
            }
            setIsLoading(false)
        });
    }
    
    const uploadVideo = () => {
        setVideoProcessed(false)
        setIsDisabled(false)
    }
    
    const onSubmitForm = async (values) => {
        const data = {"query": values["query"]};
        setMessages((prevMsg)=>
            [...prevMsg, {
                position: "right",
                type: "text",
                title: "User",
                text: values["query"],
                className: "text-black max-h-screen font-semibold font-mono",
                date: new Date(),
                status: "received",
                statusTitle: "Received",
                avatar: "https://t4.ftcdn.net/jpg/09/84/41/77/360_F_984417740_gYxjkB4WOCqAnZVvxLwVUPm7sEQK7hBQ.jpg"
            }]
        )
        try {
          const response = await fetch('http://65.1.139.145:8084/query', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data) ,
          });
    
          const reader = response.body?.getReader();
          if (!reader) return;
    
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
    
            let streamingMessage = decoder.decode(value, { stream: true });
            setMessages((prevMsg)=>
                [...prevMsg, {
                    position: "left",
                    type: "text",
                    title: "Bot",
                    text: streamingMessage,
                    avatar: "https://t4.ftcdn.net/jpg/02/11/61/95/360_F_211619589_fnRk5LeZohVD1hWInMAQkWzAdyVlS5ox.jpg",
                    className: "text-black max-h-screen font-semibold font-mono",
                    date: new Date(),
                    statusTitle: "Received",
                    status: "received"
                }]
            )
          }
        } catch (error) {
          console.error('Failed to send query:', error);
          setMessages(prev => [...prev, {
            type: 'error',
            content: 'Failed to connect to the server'
          }]);
        }
      };
    return (
        <>
            <Snackbar className="w-full" anchorOrigin={{ vertical: "top", horizontal: "center" }} open={alertOpen} autoHideDuration={3000} onClose={() => setAlertOpen(false)}>
                <Alert onClose={() => setAlertOpen(false)} severity="success">
                    YouTube Video upload successfully. You can able to do chat with Bot 
                </Alert>
            </Snackbar>
            <Snackbar className="w-full" anchorOrigin={{ vertical: "top", horizontal: "center" }} open={isError} autoHideDuration={3000} onClose={() => setIsError(false)}>
                <Alert onClose={() => setIsError(false)} severity="error">
                Youtube Url is not valid. Can you check the url 
                </Alert>
            </Snackbar>
            {/* {isError && <Alert onClose={()=>{setIsError(false)}} severity="error"></Alert>} */}
            <div className="h-auto w-auto">
                {videoProcessed && <div className="w-auto h-14 my-1 shadow-md rounded-md p-2 text-wrap text-center font-mono font-extrabold size-4 text-lg text-white">
                    YouTube Video Summarization
                </div>}
                {videoProcessed ? 
                <>
                <div className="flex flex-col mx-40 rounded-md overflow-y-auto text-white shadow-lg" style={{height: "380px", width: "980px"}}>
                    <div className="h-80 overflow-y-auto overflow-hidden">
                    <MessageList referance={heightRef} dataSource={messages}/>  
                    </div>
                </div> 
                </>:
                <div className="relative top-16 mx-40 my-20 h-56 text-wrap text-center font-mono font-extrabold text-2xl text-white">
                    YouTube Video Summarization
                    <div className="text-xl">
                     What can I help with?
                    </div>
                </div>}
                
                <Formik
                    validateOnBlur={false}
                    validateOnChange={false}
                        initialValues={{ query: ""}}
                        onSubmit={async (values, { resetForm }) => {
                            onSubmitForm(values)
                            resetForm({
                                values: { query: ""}
                            })
                        }}
                        // validationSchema={formValidationSchema}
                    >
                        {({ setFieldValue, values, submitForm, errors }) => (
                            <Form>
                                <div className="grid grid-flow-row gap-y-3">
                                    <div className="mx-40 h-10 px-2">
                                        <Field name="inputmessage" >
                                        {({ field }) => (
                                            <>
                                                <div className="flex flex-row">
                                                    <Input disabled={isDisabled || isLoading} onChange={(e)=> setUrl(e.target.value)} required placeholder="Enter the YouTube Url..." sx={{paddingLeft: "10px", width: "900px"}} value={url} className="focus:outline-none block h-15 resize-none rounded-md border-0 px-0 py-2 bg-slate-200" autoFocus=""></Input>
                                                    {!isLoading ? 
                                                        <>
                                                            <Tooltip title="Upload the url">
                                                                <IconButton disabled={isDisabled} sx={{color:"red", height: "32px", width: "35px"}} className="relative border-1 bg-white rounded-lg float-right right-9 top-2 cursor-pointer">
                                                                    <UploadOutlinedIcon onClick={submitVideoId}/> 
                                                                </IconButton>
                                                            </Tooltip>
                                                            {videoProcessed && <Tooltip title="Add url">
                                                                <IconButton sx={{color:"black", height: "32px", width: "35px"}} className="relative right-8 top-2 border-2 bg-white rounded-lg size-4 cursor-pointer">
                                                                    <AddIcon onClick={uploadVideo}/> 
                                                                </IconButton>
                                                            </Tooltip>}
                                                        </>
                                                    : 
                                                    <Button className="relative right-16" 
                                                        size="medium"
                                                        startIcon={
                                                            isLoading ? (
                                                              <CircularProgress size={25} sx={{ color: 'red' }} />  // Change color here
                                                            ) : null
                                                          }
                                                    />}
                                                </div>
                                            </>
                                        )}
                                        </Field>
                                    </div>
                                    <Field name="query">
                                        {({ field }) => (
                                            <>
                                                <div className="group flex mx-40">
                                                    <div style={{border: "2px dashed white"}} className="flex w-full bg-slate-200 cursor-text flex-col rounded-xl px-2.5 py-1">
                                                        <div className="flex min-h-[44px] items-center px-2" style={{color: "white"}}>
                                                            <div className="max-w-full flex-1">
                                                                <div className="overflow-auto">
                                                                    <TextareaAutosize disabled={isLoading} required onChange={submitForm} {...field} style={{color: "black", maxHeight: "70px"}} className="focus:outline-none block h-10 w-full resize-none border-0 bg-transparent px-0 py-2" autoFocus="" placeholder="Chat here...">
                                                                    </TextareaAutosize>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex h-[44px] items-center justify-between">
                                                        <div className="flex gap-x-1">
                                                            <div className="relative">
                                                                <div className="relative">
                                                                    <div className="flex flex-col">
                                                                        <div type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="radix-:re:" data-state="closed"></div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {videoProcessed && <Button  className="hover:bg-black" sx={{position: "relative", left: "450px" , bottom: "45px"}} onClick={handleOpen} color="info">Open Video</Button>}
                                                        <Modal
                                                            aria-labelledby="transition-modal-title"
                                                            aria-describedby="transition-modal-description"
                                                            open={open}
                                                            onClose={handleClose}
                                                            closeAfterTransition
                                                            slots={{ backdrop: Backdrop }}
                                                            slotProps={{
                                                            backdrop: {
                                                                timeout: 500,
                                                            },
                                                            }}
                                                        >
                                                            
                                                            <Box sx={style}>
                                                                <iframe width="560" height="315" src={embedUrl} title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
                                                            </Box>
                                                            </Modal>
                                                        <span data-state="closed">
                                                            {videoProcessed && <button type="submit" onSubmit={submitForm} disabled="" aria-label="Send prompt" data-testid="send-button" className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:opacity-70 focus-visible:outline-none focus-visible:outline-black disabled:text-[#f4f4f4] disabled:hover:opacity-100 dark:focus-visible:outline-white disabled:dark:bg-token-text-quaternary dark:disabled:text-token-main-surface-secondary bg-black text-white dark:bg-white dark:text-black disabled:bg-[#D7D7D7]">
                                                                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="icon-2xl"><path fillRule="evenodd" clipRule="evenodd" d="M15.1918 8.90615C15.6381 8.45983 16.3618 8.45983 16.8081 8.90615L21.9509 14.049C22.3972 14.4953 22.3972 15.2189 21.9509 15.6652C21.5046 16.1116 20.781 16.1116 20.3347 15.6652L17.1428 12.4734V22.2857C17.1428 22.9169 16.6311 23.4286 15.9999 23.4286C15.3688 23.4286 14.8571 22.9169 14.8571 22.2857V12.4734L11.6652 15.6652C11.2189 16.1116 10.4953 16.1116 10.049 15.6652C9.60265 15.2189 9.60265 14.4953 10.049 14.049L15.1918 8.90615Z" fill="currentColor"></path></svg>
                                                            </button>}
                                                        </span>
                                                    </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </Field>
                                </div>
                            </Form>)}
                </Formik>
            </div>
        </>
    )
}
