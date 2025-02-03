import os

from fastapi import FastAPI, APIRouter
from fastapi.responses import StreamingResponse
from fastapi.requests import Request
import json
from fastapi.middleware.cors import CORSMiddleware
from llama_index.multi_modal_llms.huggingface import HuggingFaceMultiModal

from backend.src.video_extract import *
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter()


@router.post("/query")
def video_processing():
    metadata_vid = download_video(url="")
    video_to_images()
    video_to_audio()
    audio_to_text()
    retriever_engine = vectordb_retriever()
    images, txt = retrieve(retriever_engine, "")
    images_documents = SimpleDirectoryReader(input_dir=os.getenv("DOCUMENTS_PATH"), input_files=images)
    content_str = "".join(txt)
    metadata_str = json.dumps(metadata_vid)

    qa_tmpl_str = (
        "Given the provided information, including relevant images and retrieved context from the video, \
     accurately and precisely answer the query without any additional prior knowledge.\n"
        "Please ensure honesty and responsibility, refraining from any racist or sexist remarks.\n"
        "---------------------\n"
        "Context: {context_str}\n"
        "Metadata for video: {metadata_str} \n"
        "---------------------\n"
        "Query: {query_str}\n"
        "Answer: "
    )
    qa_tmpl_str.format(content_str=content_str, metadata_vid=metadata_str, query_str="")

    model = HuggingFaceMultiModal.from_model_name(
        model_name="meta-llama/Llama-3.2-11B-Vision", trust_remote_code=True, max_new_tokens=2048)


app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
