CREATE DATABASE VECRON ;
USE VECRON;
CREATE TABLE users (
	id INT auto_increment,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    gender ENUM('MALE','FEMALE','Others'),
    date_of_birth DATE,
    created_at timestamp DEFAULT current_timestamp
    
);
SELECT *FROM USERS;