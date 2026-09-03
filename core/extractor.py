from .summerize import get_llm
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough , RunnableLambda

def build_chain(system_prompts:str):
    llm = get_llm()
    system = RunnablePassthrough() | RunnableLambda(lambda x:{"text": x}) | ChatPromptTemplate.from_messages([
        ("system", system_prompts),
        ("human", "{text}")
    ]) | llm | StrOutputParser()
    return system

def extract_key_points(transcript: str) -> str:
    system_prompts =  """You are an expert lesson analyst Analyze the lesson transcript and provide:
    - small description
    - Main topic
    - Key concepts
    - Important points
    - Examples mentioned
    Use only information from the transcript. Do not add external information.
    Format as a numbered list. if not found, write "No information available" for that section. Use clear and concise language."""
    chain = build_chain(system_prompts)
    return chain.invoke(transcript)


def extract_questions(transcript: str) -> str:
    system_prompts = """You are an expert lesson analyst. Analyze the lesson transcript and generate a list of questions that can be used to assess understanding of the lesson. 
    - Include a variety of question types (short answer, medium answer etc.)
    - Ensure questions cover all key concepts and important points from the transcript.
    - Avoid adding any information not present in the transcript.
    Format as a numbered list. If no questions can be generated, write "No questions available"."""
    chain = build_chain(system_prompts)
    return chain.invoke(transcript)
