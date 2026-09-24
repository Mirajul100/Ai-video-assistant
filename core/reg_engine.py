from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.chat_history import InMemoryChatMessageHistory
from .vector_store import get_retriever, load_vector_store, create_vector_store
from .summerize import get_llm

chat_memory = {}

def get_chat_history(session_id):
    if session_id not in chat_memory:
        chat_memory[session_id] = InMemoryChatMessageHistory()
    return chat_memory[session_id]

def clear_chat_memory(session_id):
    chat_memory.pop(session_id, None)

def format_doc(docs):
    return "\n\n".join(d.page_content for d in docs if d.page_content)

def create_prompt():
    return ChatPromptTemplate.from_messages([
        ("system", """You are Lumen, an AI lesson assistant.

Answer the user's question using the lesson transcript as the main source.

Rules:
- Understand the meaning of the transcript, not only exact words.
- Give a clear, accurate, and concise answer.
- Use the conversation history to understand follow-up questions.
- Do not invent what the instructor said.
- If the transcript mentions a concept but does not include its formula, definition, or details, you may use correct general knowledge to explain it.
- Any extra information must be directly related to the lesson.
- Do not answer completely unrelated questions.
- If the transcript does not provide enough context to answer the question, say:
"The lesson transcript does not provide enough information to answer this question."

Lesson transcript:
{context}"""),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{question}")
    ])

def build_reg_chain(transcripts, session_id):
    vector_store = create_vector_store(transcripts, session_id)
    retriever = get_retriever(vector_store, k=5)
    prompt = create_prompt()
    llm = get_llm()

    def retrieve_context(data):
        return format_doc(retriever.invoke(data["question"]))

    return (
        {"context": retrieve_context,
         "question": lambda d: d["question"],
         "chat_history": lambda d: d["chat_history"]}
        | prompt | llm | StrOutputParser()
    )

def load_reg_chain(session_id):
    vector_store = load_vector_store(session_id)
    retriever = get_retriever(vector_store, k=5)
    prompt = create_prompt()
    llm = get_llm()

    def retrieve_context(data):
        return format_doc(retriever.invoke(data["question"]))

    return (
        {"context": retrieve_context,
         "question": lambda d: d["question"],
         "chat_history": lambda d: d["chat_history"]}
        | prompt | llm | StrOutputParser()
    )

def ask_question(reg_chain, question, session_id):
    history = get_chat_history(session_id)
    answer = reg_chain.invoke({
        "question": question,
        "chat_history": history.messages
    })
    history.add_user_message(question)
    history.add_ai_message(answer)
    return answer