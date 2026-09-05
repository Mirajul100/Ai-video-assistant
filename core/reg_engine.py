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
            """
            You are an AI lesson assistant.

            Answer the user's question using the lesson transcript as the main source.

            Rules:
            - Understand the meaning of the transcript, not only exact words.
            - Give a clear, accurate, and concise answer.
            - Do not invent what the instructor said.
            - If the transcript mentions a concept but does not include its formula, definition, or details, you may use correct general knowledge to explain it.
            - For example, if the transcript talks about information but does not show the formula, you can provide the standard information formula.
            - Any extra information must be directly related to the lesson.
            - If the transcript does not provide enough context to understand what the user is asking, say:
            "The lesson transcript does not provide enough information to answer this question."
            - Do not answer completely unrelated questions.
            - Create a small memory of your current chat from transcribe.

            Lesson transcript:
            {context}
            """
        ),
        (
            "human",
            """Give the best possible answer."""
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
            """
            You are an AI lesson assistant.

            Answer the user's question using the lesson transcript as the main source.

            Rules:
            - Understand the meaning of the transcript, not only exact words.
            - Give a clear, accurate, and concise answer.
            - Do not invent what the instructor said.
            - If the transcript mentions a concept but does not include its formula, definition, or details, you may use correct general knowledge to explain it.
            - For example, if the transcript talks about information but does not show the formula, you can provide the standard information formula.
            - Any extra information must be directly related to the lesson.
            - If the transcript does not provide enough context to understand what the user is asking, say:
            "The lesson transcript does not provide enough information to answer this question."
            - Do not answer completely unrelated questions.
            - Create a small memory of your current chat from transcribe.

            Lesson transcript:
            {context}
            """
        ),
        (
            "human",
            """Give the best possible answer."""
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