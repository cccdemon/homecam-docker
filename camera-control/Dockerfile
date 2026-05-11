FROM alpine:3.20

RUN apk add --no-cache python3 v4l-utils

WORKDIR /app
COPY server.py /app/server.py

EXPOSE 8090
CMD ["python3", "/app/server.py"]
