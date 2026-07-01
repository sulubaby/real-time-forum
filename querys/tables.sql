CREATE TABLE IF NOT EXISTS users (
    id integer PRIMARY KEY,
    Nickname VARCHAR2(50) UNIQUE NOT NULL,
    first_name VARCHAR2(50) NOT NULL,
    last_name VARCHAR2(50) NOT NULL,
    age integer NOT NULL,
    email VARCHAR2(100) UNIQUE NOT NULL,
    gender VARCHAR2(10) NOT NULL,
    password VARCHAR2(255) NOT NULL,
);

CREATE TABLE IF NOT EXISTS sessions (
id integer PRIMARY KEY,
    user_id integer NOT NULL,
    session_token VARCHAR2(255) UNIQUE NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);


CREATE TABLE IF NOT EXISTS posts (
    id integer PRIMARY KEY,
    user_id integer NOT NULL,
    category_id integer NOT NULL,
    content VARCHAR2(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS comments (
    id integer PRIMARY KEY,
    post_id integer NOT NULL,
    user_id integer NOT NULL,
    content VARCHAR2(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS categories (
    post_id integer not null,
    category_id integer not null,
    name VARCHAR2(50) UNIQUE NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(id)
);

CREATE TABLE IF NOT EXISTS reactions_comments (
id integer PRIMARY KEY,
comment_id integer not null,
user_id integer not null,
reaction_type VARCHAR2(50) not null,
    FOREIGN KEY (comment_id) REFERENCES comments(id),
    FOREIGN KEY (user_id) REFERENCES users(id)

);

CREATE TABLE IF NOT EXISTS reactions_posts (

)

CREATE TABLE IF NOT EXISTS chats (
    id integer PRIMARY KEY,
    user1_id integer NOT NULL,
    user2_id integer NOT NULL,
    FOREIGN KEY (user1_id) REFERENCES users(id),
    FOREIGN KEY (user2_id) REFERENCES users(id)
);