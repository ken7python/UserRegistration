CREATE DATABASE USER_DB;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id CHAR(36) NOT NULL DEFAULT (UUID()),
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
);