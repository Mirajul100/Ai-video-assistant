import os
import pypdf
import docx
from pptx import Presentation
from langchain_core.documents import Document

def load_pdf_pages(file_path: str) -> list[Document]:
    reader = pypdf.PdfReader(file_path)
    return [
        Document(
            page_content=page.extract_text() or "",
            metadata={"source": file_path, "page": i},
        )
        for i, page in enumerate(reader.pages)
    ]

def load_word_pages(file_path: str) -> list[Document]:
    doc = docx.Document(file_path)
    full_text = [para.text for para in doc.paragraphs if para.text.strip()]
    
    # Returning as a single document chunk for the whole Word file
    return [Document(
        page_content="\n\n".join(full_text),
        metadata={"source": file_path}
    )]

def load_ppt_pages(file_path: str) -> list[Document]:
    prs = Presentation(file_path)
    docs = []
    
    for i, slide in enumerate(prs.slides):
        slide_text = []
        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text.strip():
                slide_text.append(shape.text.strip())
                
        if slide_text:
            docs.append(Document(
                page_content="\n".join(slide_text),
                metadata={"source": file_path, "slide": i + 1}
            ))
            
    return docs

def load_any_document(file_path: str) -> list[Document]:
    """Loads PDF, DOCX, or PPTX and returns a list of Langchain Documents."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
        
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == '.pdf':
        return load_pdf_pages(file_path)
    elif ext in ['.docx', '.doc']:
        return load_word_pages(file_path)
    elif ext in ['.pptx', '.ppt']:
        return load_ppt_pages(file_path)
    else:
        raise ValueError(f"Unsupported file format: {ext}. Please use PDF, DOCX, or PPTX.")