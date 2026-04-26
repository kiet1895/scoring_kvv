import os
from dotenv import load_dotenv
import google.generativeai as genai

# Load .env
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

print(f"API Key found: {'Yes' if api_key else 'No'}")

if api_key:
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")
        print("Sending test prompt to Gemini API...")
        response = model.generate_content("Say 'Hello, the API is working!'")
        print(f"Gemini API Response: {response.text}")
        print("SUCCESS: The Gemini API key is valid and working!")
    except Exception as e:
        print(f"ERROR: Failed to connect to Gemini API. Details: {e}")
else:
    print("ERROR: API key is not set in .env")
