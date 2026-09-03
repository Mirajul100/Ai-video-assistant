from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from .vector_store import get_retriever, load_vector_store, create_vector_store
from .summerize import get_llm


def format_doc(doc):
    formatted_doc = [document.page_content for document in doc]
    return "\n\n".join(formatted_doc)


def build_reg_chain(transcripts: str):
    vector_store = create_vector_store(transcripts)
    retriever = get_retriever(vector_store, k=5)
    llm = get_llm()

    prompt_template = ChatPromptTemplate.from_messages([
        (
            "system",
            """You are an expert lesson assistant. Answer the user's question using the lesson transcript provided.

If the answer is not found in the transcript, say:
"Could not find this information in the lesson transcript."

Be concise and precise.

Use the lesson transcript as the main source of information.
Do not invent information.
If a small amount of outside information is necessary to explain the transcript, you may add it.

Lesson transcript:
{context}"""
        ),
        (
            "human",
            "{question}"
        )
    ])

    reg_chain = (
        {
            "context": retriever | format_doc,
            "question": RunnablePassthrough()
        }
        | prompt_template
        | llm
        | StrOutputParser()
    )

    return reg_chain


def load_reg_chain():
    vector_store = load_vector_store()
    retriever = get_retriever(vector_store, k=5)
    llm = get_llm()

    prompt_template = ChatPromptTemplate.from_messages([
        (
            "system",
            """You are an expert lesson assistant. Answer the user's question using the lesson transcript provided.

If the answer is not found in the transcript, say:
"Could not find this information in the lesson transcript."

Be concise and precise.

Use the lesson transcript as the main source of information.
Do not invent information.
If a small amount of outside information is necessary to explain the transcript, you may add it.

Lesson transcript:
{context}"""
        ),
        (
            "human",
            "{question}"
        )
    ])

    reg_chain = (
        {
            "context": retriever | format_doc,
            "question": RunnablePassthrough()
        }
        | prompt_template
        | llm
        | StrOutputParser()
    )

    return reg_chain


def ask_question(reg_chain, question: str) -> str:
    answer = reg_chain.invoke(question)
    return answer
