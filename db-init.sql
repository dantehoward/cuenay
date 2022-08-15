DROP DATABASE IF EXISTS qa_forum;
CREATE DATABASE qa_forum;
USE qa_forum;

CREATE TABLE Users(
       user_id char(16) PRIMARY KEY,
       full_name char(64),
       badge ENUM('gold', 'silver', 'bronze'),
       auto_generated boolean DEFAULT false
);

CREATE TABLE Courses(
       course_id INT PRIMARY KEY AUTO_INCREMENT,
       title char(64) NOT NULL
);

CREATE TABLE Instructors(
       user_id char(16) NOT NULL,
       course_id INT NOT NULL,
       FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
       FOREIGN KEY (course_id) REFERENCES Courses(course_id) ON DELETE CASCADE, 
       PRIMARY KEY (user_id, course_id)
);

CREATE TABLE Questions(
       question_id INT PRIMARY KEY AUTO_INCREMENT,
       user_id char(16),
       course_id INT NOT NULL,
       title CHAR(128) NOT NULL,
       body TEXT NOT NULL,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
       FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE SET NULL,
       FOREIGN KEY (course_id) REFERENCES Courses(course_id) ON DELETE CASCADE
);

CREATE TABLE Answers(
       question_id INT NOT NULL,
       user_id char(16),
       answer_type ENUM('instructor', 'student'),
       body TEXT NOT NULL,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
       FOREIGN KEY (question_id) REFERENCES Questions(question_id) ON DELETE CASCADE,
       FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE SET NULL,
       PRIMARY KEY (question_id, answer_type)
);