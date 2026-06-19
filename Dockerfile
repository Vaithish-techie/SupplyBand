# Use a lightweight Python base image
FROM python:3.10-slim

# Set the working directory
WORKDIR /app

# Copy your requirements and install them
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your backend code
COPY . .

# Make your shell script executable
RUN chmod +x run_all.sh

# Start by writing the secret variable into a YAML file, then boot the agents and the server
# Note: Hugging Face REQUIRES the web server to run on port 7860
CMD printenv AGENT_CONFIG_FILE > agent_config.yaml && ./run_all.sh & uvicorn backend:app --host 0.0.0.0 --port 7860