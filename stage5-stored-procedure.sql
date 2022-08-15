DROP PROCEDURE compute_extra_cred_students;

DELIMITER //
CREATE PROCEDURE compute_extra_cred_students(IN course_id_param INT)
BEGIN
    DECLARE loop_exit BOOLEAN DEFAULT FALSE;
    DECLARE varUserId VARCHAR(50);
    DECLARE varNumQuestionsAnswered INT;

    DECLARE rowCount INT;
    DECLARE x INT;

	DECLARE upperBoundDate DATE;
	DECLARE num_answered INT;
    DECLARE num_weeks_with_answers INT;

	DECLARE lowerBoundDate DATE;
    DECLARE userInfo CURSOR FOR ( 
        SELECT a.user_id, COUNT(*) AS num_questions_answered from Answers a JOIN Questions USING(question_id) WHERE course_id = course_id_param GROUP BY a.user_id ORDER BY num_questions_answered LIMIT rowCount
   );
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET loop_exit=TRUE;
    
	SELECT COUNT(*) INTO rowCount FROM Users;
    SET rowCount = rowCount * 0.1;
    
    DROP TABLE IF EXISTS ExtraCreditStudents;
    CREATE TABLE ExtraCreditStudents(
        user_id VARCHAR(50) PRIMARY KEY,
        course_id INT,
        num_questions_answered INT
    );
    
    OPEN userInfo;
    
    cloop: LOOP 
        FETCH userInfo INTO varUserId, varNumQuestionsAnswered;
        IF loop_exit THEN
            LEAVE cloop;
        END IF;
    

        SET x = 1;
        SELECT CURDATE() INTO upperBoundDate;
		SELECT DATE_SUB(upperBoundDate, INTERVAL 1 WEEK) INTO lowerBoundDate;

        SET num_weeks_with_answers = 0;

		WHILE x <= 16 DO
            SELECT count(*) INTO num_answered FROM Answers a JOIN Questions USING(question_id) WHERE a.user_id = varUserId AND course_id = course_id_param AND a.created_at >= lowerBoundDate AND a.created_at < upperBoundDate;
            IF (num_answered >= 1) THEN
                SET num_weeks_with_answers = num_weeks_with_answers + 1;
			END IF;
            
			SELECT DATE_SUB(lowerBoundDate, INTERVAL 1 WEEK) INTO lowerBoundDate;
            SELECT DATE_SUB(upperBoundDate, INTERVAL 1 WEEK) INTO upperBoundDate;

            SET x = x + 1;
        END WHILE;

        IF (num_weeks_with_answers > 5) THEN
            INSERT INTO ExtraCreditStudents VALUES(varUserId, course_id_param, num_weeks_with_answers);
		END IF;

    END LOOP cloop;
    CLOSE userInfo;
    
    SELECT * FROM ExtraCreditStudents ORDER BY num_questions_answered DESC;
END //
DELIMITER ;
    