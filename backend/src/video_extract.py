import os
import yt_dlp
from moviepy import VideoFileClip
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
from torch.nn.attention import SDPBackend, sdpa_kernel
from llama_index.vector_stores.lancedb import LanceDBVectorStore
from llama_index.core.indices import MultiModalVectorStoreIndex
from llama_index.core import StorageContext, SimpleDirectoryReader
from llama_index.core.vector_stores.types import VectorStoreQueryMode
from llama_index.core.schema import ImageNode
import torch
import os
from pathlib import Path

torch.set_float32_matmul_precision("high")


def download_video(url: str):
    if os.path.exists(os.path.join(os.getenv("VIDEO_PATH"), "".join(os.listdir(os.getenv("VIDEO_PATH"))))):
        os.remove(os.path.join(os.getenv("VIDEO_PATH"), "".join(os.listdir(os.getenv("VIDEO_PATH")))))
    ydl_opts = {
        'outtmpl': '%(title)s.%(ext)s',  # Save the video with the title as filename
        'format': 'bestvideo+bestaudio/best',  # Download the best quality available
        "paths": {"home": os.getenv("VIDEO_PATH")}
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
        info = ydl.extract_info(url=url, download=False)
        return {"author": info["uploader"], "title": info["fulltitle"], "views": info["view_count"]}


def video_to_images():
    exist_docs = Path(os.getenv("DOCUMENTS_PATH"))
    [file.unlink() for file in exist_docs.iterdir() if file.is_file()]
    video_clip = VideoFileClip(
        filename=os.path.join(os.getenv("VIDEO_PATH"), "".join(os.listdir(os.getenv("VIDEO_PATH")))))
    video_clip.write_images_sequence(os.path.join(os.getenv("DOCUMENTS_PATH"), os.getenv("IMAGE_FORMAT")), fps=0.2)
    return True


def video_to_audio():
    if os.path.exists(os.path.join(os.getenv("AUDIO_PATH"), os.getenv("AUDIO_FORMAT"))):
        os.remove(os.path.join(os.getenv("AUDIO_PATH"), os.getenv("AUDIO_FORMAT")))

    video_clip = VideoFileClip(
        filename=os.path.join(os.getenv("VIDEO_PATH"), "".join(os.listdir(os.getenv("VIDEO_PATH")))))
    video_clip.audio.write_audiofile(os.path.join(os.getenv("AUDIO_PATH"), os.getenv("AUDIO_FORMAT")))
    # if os.path.exists(os.path.join(os.getenv("VIDEO_PATH"), "".join(os.listdir(os.getenv("VIDEO_PATH"))))):
    #     os.remove(os.path.join(os.getenv("VIDEO_PATH"), "".join(os.listdir(os.getenv("VIDEO_PATH")))))
    return True


def audio_to_text():
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32

    if os.path.exists("backend/src/tokenizer_path") and os.path.exists("backend/src/whisper_model_path"):
        processor = AutoProcessor.from_pretrained(pretrained_model_name_or_path="backend/src/tokenizer_path")
        model = AutoModelForSpeechSeq2Seq.from_pretrained(
            pretrained_model_name_or_path="backend/src/whisper_model_path",
            torch_dtype=torch_dtype, low_cpu_mem_usage=True,
            use_safetensors=True)
    else:
        processor = AutoProcessor.from_pretrained(pretrained_model_name_or_path="openai/whisper-large-v3")
        processor.save_pretrained("./tokenizer_path")
        model = AutoModelForSpeechSeq2Seq.from_pretrained(pretrained_model_name_or_path="openai/whisper-large-v3",
                                                          torch_dtype=torch_dtype, low_cpu_mem_usage=True,
                                                          use_safetensors=True)
        model.save_pretrained("./whisper_model_path")
    model.generation_config.cache_implementation = "static"
    model.generation_config.max_new_tokens = 256
    model.forward = torch.compile(model.forward, mode="reduce-overhead", fullgraph=True)

    pipe = pipeline(task="automatic-speech-recognition", model=model, tokenizer=processor.tokenizer,
                    feature_extractor=processor.feature_extractor, torch_dtype=torch_dtype, device=device,
                    chunk_length_s=50, batch_size=32)
    generate_kwargs = {
        "max_new_tokens": 448,
        "num_beams": 1,
        "condition_on_prev_tokens": False,
        "compression_ratio_threshold": 1.35,  # zlib compression ratio threshold (in token space)
        "temperature": (0.0, 0.2, 0.4, 0.6, 0.8, 1.0),
        "logprob_threshold": -1.0,
        "no_speech_threshold": 0.6,
        "return_timestamps": True,
        "language": "english",
        "task": "translate"
    }
    with sdpa_kernel(SDPBackend.MATH):
        audio_text = pipe(inputs=os.path.join(os.getenv("AUDIO_PATH"), os.getenv("AUDIO_FORMAT")),
                          generate_kwargs=generate_kwargs)
    with open(os.path.join(os.getenv("DOCUMENTS_PATH"), os.getenv("OUTPUT_AUDIO_PATH")), "w") as file:
        file.write(audio_text.text)
    print("Text data saved to file")
    # os.remove(os.path.join(os.getenv("AUDIO_PATH"), os.getenv("AUDIO_FORMAT")))
    # print("Audio file removed")


def vectordb_retriever():
    image_vector_store = LanceDBVectorStore(uri="lancedb", table_name="image_collection")
    text_vector_store = LanceDBVectorStore(uri="lancedb", table_name="text_collection")

    storage_context = StorageContext.from_defaults(image_store=image_vector_store, vector_store=text_vector_store)
    documents = SimpleDirectoryReader(os.getenv("DOCUMENTS_PATH")).load_data()
    index = MultiModalVectorStoreIndex.from_documents(documents=documents, storage_context=storage_context)

    retriever_engine = index.as_retriever(similarity_top_k=5, image_similarity_top_k=5,
                                          vector_store_query_mode=VectorStoreQueryMode.SEMANTIC_HYBRID)
    return retriever_engine


def retrieve(retriever_engine, query_str):
    retrieval_results = retriever_engine.retrieve(query_str)

    retrieved_image = []
    retrieved_text = []
    for res_node in retrieval_results:
        if isinstance(res_node.node, ImageNode):
            retrieved_image.append(res_node.node.metadata["file_path"])
        else:
            retrieved_text.append(res_node.text)

    return retrieved_image, retrieved_text
