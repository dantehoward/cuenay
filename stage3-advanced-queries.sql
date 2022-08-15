-- Advanced query 1: Get 25 latest questions posted to course, with author information (name), how many answers were provided 
SELECT q.question_id, u.full_name AS user_full_name, q.course_id, q.title, q.body, q.created_at, COUNT(a.question_id) as num_answers
FROM Questions q JOIN Users u USING(user_id) LEFT JOIN Answers a USING(question_id)
GROUP BY q.question_id
ORDER BY q.created_at DESC, u.full_name
LIMIT 25;

-- Advanced query 2: A query for instructors, stats on which students have answered the most questions
SELECT u.user_id, u.full_name, COUNT(a.question_id) as count_questions_answered
FROM Answers a NATURAL JOIN Users u
GROUP BY u.user_id
ORDER BY num_questions_answered DESC;
