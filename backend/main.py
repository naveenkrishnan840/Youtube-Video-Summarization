import os
import shutil
import sys
from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.requests import Request
import json
from fastapi.middleware.cors import CORSMiddleware
# from llama_index.multi_modal_llms.huggingface import HuggingFaceMultiModal
from dotenv import load_dotenv
# from llama_index.llms.gemini import Gemini
from llama_index.embeddings.gemini import GeminiEmbedding
from llama_index.embeddings.clip import ClipEmbedding
from llama_index.core.prompts import ChatPromptTemplate
from llama_index.core import Settings
from llama_index.multi_modal_llms.gemini import GeminiMultiModal
from src.video_extract import *
from src.request_validate import BotRequestQuery, VideoUrlRequest

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter()

load_dotenv()
# sys.path.append("C:/Users/NavaneethanJeyapraka/ffmpeg/bin/ffmpeg")

# Settings.llm = Gemini(model_name="models/gemini-1.5-pro")
Settings.embed_model = GeminiEmbedding(model_name="models/embedding-001")


@router.post("/videoUrlProcessing")
async def video_processing(request: Request, videoUrlRequest: VideoUrlRequest):
    try:
        youtube_url = videoUrlRequest.url
        existing_url = False
        try:
            existing_url = request.app.url
            if existing_url == youtube_url:
                existing_url = True
        except Exception as e:
            request.app.url = youtube_url
            if os.path.exists(os.getenv("LANCEDB_PATH")):
                shutil.rmtree(os.getenv("LANCEDB_PATH"))
        if not existing_url:
            chk_status = download_video(request, url=youtube_url)
            if not chk_status:
                request.app.url = ""
                return HTTPException(status_code=200, detail={"status": False})
            await video_to_images()
            await video_to_audio()
            await audio_to_text()
            await set_vectordb_retriever()
            return HTTPException(status_code=200, detail={"status": True})
        else:
            return HTTPException(status_code=200, detail={"status": True})
    except Exception as e:
        raise e


@router.post("/query")
def chatbot_query(request: Request, botRequestQuery: BotRequestQuery):
    try:
        user_query = botRequestQuery.query
        return StreamingResponse(model_response_streaming(request, user_query),
                                 media_type="text/event-stream")
    except Exception as e:
        raise e


async def model_response_streaming(request: Request, user_query:str):
    retriever_engine = get_vectordb_retriever()
    images, txt = retrieve(retriever_engine, query_str=user_query)
    images_documents = SimpleDirectoryReader(input_dir=os.getenv("DOCUMENTS_PATH"), input_files=images).load_data()
    content_str = "".join(txt)
    # metadata_str = json.dumps(request.app.metadata)
    metadata_str = "{'author': 'News TV', 'title': 'News TV', 'views': 200}"

    system_prompt = """
                Given the provided information from the video, including relevant images, context, and metadata, 
                accurately summarize the key points and main takeaways of the video. Ensure that the summary is concise, 
                clear, and covers all major aspects discussed in the video without any additional prior knowledge. 
                Do not include personal opinions or speculative details. Maintain neutrality and clarity.
                 """
    human_prompt = """
           ---------------------
            Context: {context_str}
            Metadata for video: {metadata_str} 
            ---------------------
            Query: {query_str}  
            Answer:
    """
    prompt = """
                Given the provided information from the video, including relevant images, context, and metadata, 
                accurately summarize the key points and main takeaways of the video. Ensure that the summary is concise, 
                clear, and covers all major aspects discussed in the video without any additional prior knowledge. 
                Do not include personal opinions or speculative details. Maintain neutrality and clarity.
               ---------------------
                Context: {context_str}
                Metadata for video: {metadata_str} 
                ---------------------
                Query: {query_str}  
                Answer:
            """
    human_prompt = human_prompt.format(context_str=content_str, metadata_str=metadata_str, query_str=user_query)
    prompt = (("system", system_prompt), ("user", human_prompt))
    model = GeminiMultiModal(model_name="models/gemini-1.5-flash")
    response = await model.astream(prompt=ChatPromptTemplate.from_messages(message_templates=prompt),
                                   image_documents=images_documents, chunk_size=250)
    # response = model.complete(prompt=human_prompt, image_documents=images_documents)
    # yield response.text
    async for event in response:
        yield event
    # text = """
    # The News TV video discusses recent political events in India.  It highlights public sentiment against the central
    # government in Tamil Nadu, where  Udayanidhi's speech against the central government during a Sengunrat news
    # broadcast is mentioned.  The video also notes the influence of Bajaka and Mavar in the recent legislation of
    # Maharashtra, Haryana, and Delhi.  The video further mentions concerns about the actions of "Teemu Ka,"
    # suggesting public disapproval.  Finally, the Supreme Court's call for Bhattacharyya to consider the current
    # difficulties and the importance of the government's decision are highlighted, emphasizing the potential impact of
    # concentrating power in the hands of a single individual.
    # """

app.include_router(router)

# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="127.0.0.1", port=8006)
