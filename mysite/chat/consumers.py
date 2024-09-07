import json
import uuid
from asgiref.sync import async_to_sync
from channels.generic.websocket import WebsocketConsumer, AsyncWebsocketConsumer

class ChatConsumer(WebsocketConsumer):
    def connect(self):
        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        self.room_group_name = f"chat_{self.room_name}"

        # Генерация UUID для анонимного пользователя
        if self.scope['user'].is_authenticated:
            self.username = self.scope['user'].username
        else:
            # Если пользователь не авторизован, генерируем уникальный ID
            self.username = f"Anonymous_{str(uuid.uuid4())[:8]}"

        # Присоединение к группе чата
        async_to_sync(self.channel_layer.group_add)(
            self.room_group_name, self.channel_name
        )

        self.accept()

    def disconnect(self, close_code):
        # Отключение от группы чата
        async_to_sync(self.channel_layer.group_discard)(
            self.room_group_name, self.channel_name
        )

    def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message = text_data_json["message"]

        # Отправка сообщения в группу с именем пользователя
        async_to_sync(self.channel_layer.group_send)(
            self.room_group_name, {
                "type": "chat_message",
                "message": message,
                "username": self.username,
            }
        )

    def chat_message(self, event):
        message = event["message"]
        username = event["username"]

        # Отправка сообщения в WebSocket
        self.send(text_data=json.dumps({
            "message": message,
            "username": username
        }))

class VideoChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f"video_chat_{self.room_name}"

        # Присоединение к группе видеочата
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Отключение от группы видеочата
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)

        # Рассылка сигнальных данных в группу видеочата
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'send_signal',
                'data': data
            }
        )

    async def send_signal(self, event):
        data = event['data']
        await self.send(text_data=json.dumps(data))

