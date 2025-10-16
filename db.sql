CREATE DATABASE IF NOT EXISTS nginx_logs;

USE nginx_logs;

CREATE TABLE IF NOT EXISTS raw_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(10),       -- 'access' or 'error'
    log_line TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
