from langchain_mistralai import ChatMistralAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.runnables import RunnablePassthrough , RunnableLambda
from dotenv import load_dotenv
import os

from openai.resources import Chat

load_dotenv()

#Load environment variables from .env file
def get_llm():
    return ChatMistralAI(
        model="mistral-small-latest",
        mistral_api_key=os.getenv("MISTRAL_API_KEY"),
        temperature=0.3,
    )
    
#Split the transcript into smaller chunks for better processing
def  split_transcript(transcript: str) -> list:
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=3000,
        chunk_overlap=200,
        length_function=len
    )
    return text_splitter.split_text(transcript)

def summarize_transcript(transcript: str) -> str:
    llm = get_llm()

    #Create a prompt for summarizing each chunk of the transcript
    map_prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful assistant that summarizes transcripts."),
        ("human", "Summarize the following transcript in a concise manner:\n{text}")
    ])
    
    map_chain = map_prompt | llm | StrOutputParser()
    chunks = split_transcript(transcript)
    chunk_summaries = [map_chain.invoke({"text": chunk}) for chunk in chunks]
    combined_summary = "\n\n".join(chunk_summaries)
    combined_prompt = ChatPromptTemplate.from_messages([
        ("system", "You summarize transcripts in simple, clear English."),
        ("human", "Summarize the following transcript using simple English. Include only the key points:\n{text}")
    ])
    
    combined_chain = (
        RunnablePassthrough() | RunnableLambda(lambda x:{"text": x}) | combined_prompt | llm | StrOutputParser()
    )
    
    return combined_chain.invoke(combined_summary)


def generate_title(transcript: str) -> str:
    llm = get_llm()

    title_chain = (
        RunnablePassthrough() | RunnableLambda(lambda x:{"text": x}) | ChatPromptTemplate.from_messages([
            ("system", "You generate short, accurate titles for transcripts."),
            ("human", "Generate one concise title that best represents the transcript. Do not add information not present in the transcript:\n{text}")  
        ]) | llm | StrOutputParser()
    )
    
    return title_chain.invoke(transcript[:2000])  # Use only the first 2000 characters for title generation