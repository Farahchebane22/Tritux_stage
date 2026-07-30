FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Train models at build time if not present
RUN python scripts/generate_dataset.py && python scripts/clean_data.py && python scripts/train_model.py
EXPOSE 8000
CMD ["python", "main.py"]
