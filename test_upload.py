import requests
import json
import os

url = "http://localhost:8001/upload"
dummy_pdf_path = "dummy.pdf"

# Create a dummy PDF
with open(dummy_pdf_path, "wb") as f:
    f.write(b"%PDF-1.4\n%EOF\n")

answer_key = {
  "1": "A",
  "2": "B",
  "3": "C",
  "4": "D",
  "5": "A",
  "6": "B",
  "7": "C",
  "8": "D",
  "9": "A",
  "10": "B"
}

with open(dummy_pdf_path, "rb") as f:
    files = {"pdf_file": (dummy_pdf_path, f, "application/pdf")}
    data = {
        "answer_key_json": json.dumps(answer_key),
        "pages_per_student": 2
    }
    
    print(f"Sending request to {url}...")
    try:
        response = requests.post(url, files=files, data=data)
        print(f"Status Code: {response.status_code}")
        print(f"Response Body: {response.text}")
    except Exception as e:
        print(f"Request failed: {e}")

os.remove(dummy_pdf_path)
