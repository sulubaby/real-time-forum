package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)


type Client struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

func (c *Client) writeJSON(v interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.conn.WriteJSON(v)
}

var (
	clients   = make(map[int]*Client) 
	clientsMu sync.RWMutex
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true 
	},
}

type WSMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}


func Broadcast(msgType string, data interface{}) {
	msg := WSMessage{Type: msgType, Data: data}

	clientsMu.RLock()
	defer clientsMu.RUnlock()

	for _, c := range clients {
		if err := c.writeJSON(msg); err != nil {
			log.Printf("broadcast error: %v", err)
		}
	}
}


func SendToUser(userID int, msgType string, data interface{}) bool {
	clientsMu.RLock()
	c, ok := clients[userID]
	clientsMu.RUnlock()

	if !ok {
		return false
	}
	msg := WSMessage{Type: msgType, Data: data}
	if err := c.writeJSON(msg); err != nil {
		log.Printf("send to user %d error: %v", userID, err)
		return false
	}
	return true
}

func IsUserOnline(userID int) bool {
	clientsMu.RLock()
	defer clientsMu.RUnlock()
	_, ok := clients[userID]
	return ok
}

func WebSocketHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserFromSession(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("websocket upgrade error: %v", err)
		return
	}

	client := &Client{conn: conn}

	clientsMu.Lock()
	clients[userID] = client
	clientsMu.Unlock()

	broadcastUserStatus(userID, true)

	defer func() {
		conn.Close()
		clientsMu.Lock()
		if current, exists := clients[userID]; exists && current == client {
			delete(clients, userID)
			clientsMu.Unlock()
			broadcastUserStatus(userID, false)
		} else {
			clientsMu.Unlock()
		}
	}()

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			break 
		}

		var incoming WSMessage
		if err := json.Unmarshal(msg, &incoming); err != nil {
			continue
		}


		HandleIncomingMessage(userID, incoming)
	}
}

func broadcastUserStatus(userID int, online bool) {
	msgType := "user_offline"
	if online {
		msgType = "user_online"
	}
	Broadcast(msgType, map[string]interface{}{"userId": userID})
}


func HandleIncomingMessage(senderID int, msg WSMessage) {
	switch msg.Type {
	// case "chat_message":
	//     handle chat send here (parse msg.Data, insert into messages table,
	//     then SendToUser(receiverID, "chat_message", payload))
	default:
		log.Printf("unhandled incoming message type %q from user %d", msg.Type, senderID)
	}
}