CREATE DEFINER=`root`@`%` TRIGGER `Answers_AFTER_INSERT` AFTER INSERT ON `Answers` FOR EACH ROW BEGIN
	DECLARE badge VARCHAR(15);
			
	SET @answerCount = (SELECT Count(*) FROM Answers WHERE user_id = NEW.user_id );

	IF (@answerCount >= 10 AND @answerCount < 25) THEN
		SET @badge = "bronze";
	ELSEIF (@answerCount >= 25 AND @answerCount < 50) THEN
		SET @badge = "silver";
	ELSEIF (@answerCount >= 50 AND @answerCount < 100) THEN
		SET @badge = "gold";
	ELSEIF (@answerCount >= 100) THEN
		SET @badge = "emerald";
	ELSE
		SET @badge = NULL;
	END IF;
	UPDATE Users SET badge = @badge WHERE user_id = NEW.user_id;
END