import requests

url = "http://localhost:8001/upload"
headers = {
    "Origin": "http://localhost:5174",
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "content-type"
}

response = requests.options(url, headers=headers)
print(f"Status Code: {response.status_code}")
print(f"Headers: {response.headers}")
print(f"Body: {response.text}")
