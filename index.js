var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var bodyParser = require('body-parser');
var session = require('express-session');
var mysql = require('mysql2');
var sqlSanitizer = require('sql-sanitizer');

var db = mysql.createConnection({
    host: '34.132.122.190',
    user: 'root',
    password: 'U%SVwDv#Re2JAG',
    database: 'qa_forum'
});
db.connect((error) => {
	if (error != null) {
		console.error(error);
	} else {
		console.log('Successfully connected to database');
	}
});

const defaults = {
    user_id: 'alawini',
    course_id: 1, // CS 411
};

var app = express();
 
// set up ejs view engine 
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(cookieParser());
app.use(bodyParser());
app.use(logger('dev'));
app.use(express.json());
app.use(sqlSanitizer);

app.use(express.urlencoded({extended:false}));
app.use(express.static(path.join(__dirname,'public')));

app.use(session({ 
    secret: '123456catr',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60000 }
}));

function selectUserMiddleware(req, res, next) {  
    var user_id = null;
	
    if (req.cookies.user_id == undefined
	|| req.cookies.user_id == 'undefined'
	|| typeof req.cookies.user_id == 'undefined') {

	res.cookie('user_id', defaults.user_id);
	user_id = defaults.user_id;
    }
    else {
	user_id = req.cookies.user_id;
    }
    db.query(
	`SELECT * FROM Users WHERE user_id = '${user_id}';`,
	function(err, results) {
	    if (err) next(err);
	    if (results.length != 1)
		next(Error(`No user ${user_id} found`));
	    res.locals.user = results[0];
	    next();
	}
    );
}

function selectCourseMiddleware(req, res, next) {
    db.query(
	`SELECT * FROM Courses WHERE course_id = ${req.params.course_id};`,
	(err, results) => {
	    if (err) return next(err);
	    if (results.length == 0) { res.send(404); }
	    res.locals.course = results[0];
	    next();
	}
    );
}

function selectQuestionMiddleware(req, res, next) {
    db.query(
	`SELECT 
		q.question_id,
		q.user_id,
		q.course_id,
		q.title,
		q.body,
		q.created_at,
		u.full_name AS user_full_name,
		u.badge AS user_badge
	FROM 
		Questions q 
		JOIN Users u ON q.user_id = u.user_id
	WHERE 
		q.question_id = ${req.params.question_id};
	`,
	(err, results) => {
	    if (err) return next(err);
	    if (results.length == 0) { return res.sendStatus(404); }

	    const question = results[0];
	    res.locals.question = question;

	    req.params.course_id = question.course_id;
	    next();
	}
    );
}

function selectStudentAnswerMiddleware(req, res, next) {
    db.query(
	`SELECT 
		a.question_id,
		a.user_id,
		a.answer_type,
		a.body,
		a.created_at,
		u.full_name AS user_full_name,
		u.badge AS user_badge
	FROM 
		Answers a 
		JOIN Users u ON a.user_id = u.user_id
	WHERE 
		a.question_id = ${res.locals.question.question_id} AND a.answer_type = 'student';
	`,
	(err, results) => {
	    if (err) return next(err);
	    if (results.length == 0) {
			res.locals.studentAnswer = null;
			return next(); 
		}
	    res.locals.studentAnswer = results[0];
	    next();
	}
    );
}

function selectInstructorAnswerMiddleware(req, res, next) {
    db.query(
	`SELECT 
		a.question_id,
		a.user_id,
		a.answer_type,
		a.body,
		a.created_at,
		u.full_name AS user_full_name,
		u.badge AS user_badge
	FROM 
		Answers a 
		JOIN Users u ON a.user_id = u.user_id
	WHERE 
		a.question_id = ${res.locals.question.question_id} AND a.answer_type = 'instructor';
	`,
	(err, results) => {
	    if (err) return next(err);
	    if (results.length == 0) {
			res.locals.instructorAnswer = null;
			return next(); 
		}
	    res.locals.instructorAnswer = results[0];
	    next();
	}
    );
}


function selectRecentQuestionsMiddleware(req, res, next) {
    const recentQuestionsQuery = `
	SELECT 
		q.question_id, 
		q.course_id, 
		q.title, 
		q.body, 
		q.created_at, 
		u.user_id AS user_id,
		u.full_name AS user_full_name,
		u.badge AS user_badge,
		COUNT(a.question_id) as count_answers
	FROM 
		Questions q 
		JOIN Users u USING(user_id) 
		LEFT JOIN Answers a USING(question_id)
	WHERE q.course_id = ${res.locals.course.course_id}
	GROUP BY q.question_id
	ORDER BY q.created_at DESC, u.full_name
	LIMIT 16;
	`;
    db.query(
	recentQuestionsQuery,
	function(err, results) {
	    if (err) next(err);
	    res.locals.recentQuestions = results;
	    next();
	}
    );
}

function selectCourseUsersMiddleware(req, res, next) {
    db.query(`
(
SELECT u.*, 'instructor' AS role
FROM Users u 
INNER JOIN Instructors i ON i.user_id = u.user_id 
WHERE i.course_id = ${res.locals.course.course_id}
)
UNION (
SELECT u.*, 'student' AS role
FROM Users u
LIMIT 10
);
`,
	(err, results) => {
	    if (err) next(err);
	    res.locals.courseUsers = results;
	    next();
	}
    );
}

function selectCoursesMiddleware(req, res, next) {
    db.query(
	`SELECT * FROM Courses;`,
	(err, results) => {
	    if (err) next(err);
	    res.locals.courses = results;
	    next();
	}
    );
}

function selectCourseTopStudents(req, res, next) {
    const topStudentsQuery = `
SELECT u.*, COUNT(a.question_id) as count_questions_answered
FROM Questions q 
  JOIN Answers a ON q.question_id = a.question_id
  JOIN Users u ON u.user_id = a.user_id
WHERE q.course_id = ${res.locals.course.course_id}
  AND a.answer_type = 'student'
GROUP BY u.user_id
ORDER BY count_questions_answered DESC
LIMIT 10;
`;
    db.query(
	topStudentsQuery,
	function(err, results) {
	    if (err) return next(err);
	    res.locals.topStudents = results;
	    next();
	}
    );
}

function selectExtraCredit(req, res, next) {
    const ecProcedure = `CALL compute_extra_cred_students(${res.locals.course.course_id});`
    db.query( ecProcedure, function(err, results) {
        if (err) return next(err);
        res.locals.ecTable = results[0];
        next();
    });
}

app.use('/', [
    selectUserMiddleware,
    selectCoursesMiddleware,
]);

app.get('/', function(req, res, next) {
    res.redirect(`/c/${defaults.course_id}`);
});

app.post('/login', function(req, res, next) {
    // console.log({req_body: req.body});
    res.cookie('user_id', req.body['user-select']);
    res.redirect('/');
});

app.get('/c/:course_id', [
    selectCourseMiddleware,
    selectRecentQuestionsMiddleware,
    selectCourseUsersMiddleware,
    selectCourseTopStudents,
    function(req, res, next) {
		res.locals.page = 'course.ejs';
		res.locals.title = res.locals.course.title;
		res.render('index');
    },
]);

app.get('/c/:course_id/search', [
    selectCourseMiddleware,
    selectRecentQuestionsMiddleware,
    selectCourseUsersMiddleware,
    function(req, res, next) {
	console.log(req.query);
	db.query(`SELECT * FROM Questions HAVING MATCH(title,body) AGAINST ('${req.query.q.split(' ').join(' +')}' IN BOOLEAN MODE);`,
		 function(err, results) {
		     if (err) return next(err);
		     res.locals.searchResults = results;
		     res.locals.page = 'searchResults';
		     res.locals.title = 'Search Results';
		     res.render('index');
		 }
	);
    }
]);

app.get('/c/:course_id/extra_credit', [
    selectCourseMiddleware,
    selectRecentQuestionsMiddleware,
    selectCourseUsersMiddleware,
    selectExtraCredit,
    function(req, res, next) {
        res.locals.page = 'extraCredit';
        res.locals.title = res.locals.course.title;
        res.render('index')
    }
]);

app.get('/c/:course_id/ask', [
    selectCourseMiddleware,
    selectRecentQuestionsMiddleware,
    selectCourseUsersMiddleware,
    function(req, res, next) {
		res.locals.page = 'question_new';
		res.locals.title = 'New Question';
		res.render('index');
    },
]);

app.post('/c/:course_id/ask', [
	function(req, res, next) {
		db.query(`
		INSERT INTO Questions (
			user_id,
			course_id,
			title,
			body
		)
		VALUES (
			'${res.locals.user.user_id}',
			'${req.params.course_id}',
			'${req.body.question_title.trim()}',
			'${req.body.question_body.trim()}'
		);
		`, function(err, results) {
			if (err) return next(err);
			res.redirect(`/q/${results.insertId}`);
		});
	}
]);

app.get('/q/:question_id', [
    selectQuestionMiddleware,
	selectStudentAnswerMiddleware,
	selectInstructorAnswerMiddleware,
    selectCourseMiddleware,
    selectRecentQuestionsMiddleware,
    selectCourseUsersMiddleware,
    function(req, res, next) {
		res.locals.page = 'question';
		res.locals.title = res.locals.question.title;
		res.render('index');
    },
]);

/*
db.query(`

	`, 
	function(err, results) {

	}
);
 */

// update or delete existing question/answer
app.post('/q/:question_id', [
	function(req, res, next) {
		
		console.log(req.body);
		const answerType = ({
			'question': null,
			'student_answer': 'student',
			'instructor_answer': 'instructor',
		})[req.body.post_type];

		if (req.body.action == 'delete') {
			if (req.body.post_type == 'question') {
				db.query(`
					DELETE FROM Questions
					WHERE question_id = ${req.params.question_id};
					`,
					function(err, results) {
						if (err) return next(err);
						res.redirect(`/c/${res.locals.course.course_id}`);
					}
				);
			} else {
				db.query(`
					DELETE FROM Answers
					WHERE 
						question_id = ${req.params.question_id}
						AND answer_type = '${answerType}';
					`,
					function(err, results) {
						if (err) return next(err);
						res.redirect('back');
					}
				);
			}
		}
		else if (req.body.action == 'update') {
			if (req.body.post_type == 'question') {
				db.query(`
					UPDATE Questions
					SET body = '${req.body.post_body.trim()}'
					WHERE question_id = ${req.params.question_id};
					`,
					function(err, results) {
						if (err) return next(err);
						res.redirect('back');
					}
				);
			} else {
				db.query(`
					UPDATE Answers
					SET body = '${req.body.post_body.trim()}'
					WHERE
						question_id = ${req.params.question_id}
						AND answer_type = '${answerType}';
					`,
					function(err, results) {
						if (err) return next(err);
						res.redirect('back');
					}
				);
			}
		}
		else if (req.body.action == 'create') {
			db.query(`
				INSERT INTO Answers (
					question_id,
					user_id,
					answer_type,
					body
				)
				VALUES (
					${req.params.question_id},
					'${res.locals.user.user_id}',
					'${answerType}',
					'${req.body.post_body.trim()}'
				);
				`,
				function(err, results) {
					if (err) return next(err);
					res.redirect('back');
				}
			);
		}
		else res.send(401, 'yikes!');
    },
]);

app.post('/q/:question_id/delete', [
    selectQuestionMiddleware,
    function(req, res, next) {
	db.query(
	    `DELETE FROM Questions WHERE question_id = ${req.params.question_id};`,
	    function(err, results) {
		if (err) return next(err);
		res.redirect(`/c/${req.params.course_id}`);
	    }
	);
    },
]);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
 
  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

const port = 3000;
app.listen(port, function () {
    console.log(`Node app is running on port ${port}`);
});
 
module.exports = app;
