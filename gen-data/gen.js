const fs = require('fs');
const path = require('path');
const mysql = require('mysql2');
const { assert } = require('console');

const LoremIpsum = require("lorem-ipsum").LoremIpsum;
const gaussian = require('gaussian');

const max_users = 150;
const num_questions = 1000;
const num_student_answers = 850;
const num_instructor_answers = 950;
const answers_author_sample_mean = max_users / 2;
const answers_author_sample_var = max_users / 6;

const db = mysql.createConnection({
    host: '34.132.122.190',
    user: 'root',
    password: 'U%SVwDv#Re2JAG',
    database: 'qa_forum',
});

function formatSqlInsertion(tableName, columnNames, rows) {
    if (!rows.length) throw new Error('rows is empty or not an array');

    const tuplesFormatted = rows.map(row => `(${row.map(e => (typeof e == 'string') ? `'${e.toString()}'` : e).join(',')})`).join(',');
    return `
INSERT INTO ${tableName} (${columnNames.join(',')})
VALUES ${tuplesFormatted};`;
}

function formatSqlDate(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function sql_promise_query(query) {
    return await new Promise((resolve, reject) => {
        return db.query(query, (err, result) => {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
};

async function sqlResetCounter(tableName) {
    await sql_promise_query(`ALTER TABLE ${tableName} auto_increment = 10000;`);
}

async function sqlTruncateTable(tableName) {
    await sql_promise_query(`SET FOREIGN_KEY_CHECKS = 0;`);
    await sql_promise_query(`TRUNCATE TABLE ${tableName};`);
    await sql_promise_query(`SET FOREIGN_KEY_CHECKS = 1;`);
    // await sql_promise_query(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE;`);
    await sqlResetCounter(tableName);
}

Math.randomInt = function(n) {
    return Math.floor(Math.random()*n);
}

Math.randomPick = function(arr) {
    return arr[Math.randomInt(arr.length)];
}

function datePickInRange(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

// start from a completely fresh database and generate all data ontop of it
(async () => {
    try {

        // ping database
        db.connect((err) => {
            if (err) console.log("db connection failed", err);
            else console.log("connected to database");
        });

        // with deletion cascading, this *should* be the only table we have to wipe!
        console.log('wiping database');
        await sqlTruncateTable('Courses');
        await sqlTruncateTable('Users');
        await sqlTruncateTable('Instructors');
        await sqlTruncateTable('Questions');
        await sqlTruncateTable('Answers');
 
        console.log('inserting courses');
        const courses = [
            { course_id: 1, title: 'CS 411: Database Systems' },
            { course_id: 2, title: 'CS 241: System Programming' },
            { course_id: 3, title: 'CS 374: Introduction to Algorithms and Models of Computation' },
        ];
        const insertCoursesCols = ['course_id', 'title'];
        const insertCoursesRows = courses.map(c => [c.course_id, c.title]);
        const insertCoursesQuery = formatSqlInsertion('Courses', insertCoursesCols, insertCoursesRows);
        await sql_promise_query(insertCoursesQuery);

        console.log('inserting instructor users');
        const instructors = [
            { course_id: 1, user_id: 'alawini', full_name: 'Abdu Alawini' },
            { course_id: 1, user_id: 'kalidas', full_name: 'Suryasri Kalidas' },
            { course_id: 2, user_id: 'angrave', full_name: 'Lawrence Angrave' },
            { course_id: 3, user_id: 'jeffe',   full_name: 'Jeff Erickson' },
        ];
        instructorUserColumns = ['user_id', 'full_name'];
        instructorUserRows = instructors.map(i => [i.user_id, i.full_name]);
        await sql_promise_query(
            formatSqlInsertion('Users', instructorUserColumns, instructorUserRows)
        );
        console.log('inserting instructor relationships');
        instructorEntityColumns = ['user_id', 'course_id'];
        instructorEntityRows = instructors.map(i => [i.user_id, i.course_id]);
        await sql_promise_query(
            formatSqlInsertion('Instructors', instructorEntityColumns, instructorEntityRows)
        );

        console.log('auto-generating users')
        function userNameToId(userName) {
            const [first, last] = userName.split(' ');
            const firstLower = first.toLowerCase();
            const extraFlayvah = String.fromCharCode(
                // random lowercase letter
                97+Math.floor(Math.random() * 26)
            );
            const lastInitial = last.charAt(0).toLowerCase();
            const randomDigit = 1 + Math.floor(Math.random()*10);
            return firstLower + extraFlayvah + lastInitial + randomDigit;
        }

        const names_path = path.join(__dirname, 'names.txt');
        console.log(`reading user names from ${names_path}`);
        var names_str = fs.readFileSync(names_path, 'utf8');
        var user_names = names_str
            .split('\n') // split on newline
            .slice(0,-1) // ignore empty string at the end
            .slice(0, max_users); // cap at a certain number of names
        const users = user_names.map(user_name => Object({
            'user_id': userNameToId(user_name),
            'full_name': user_name,
        }));
        console.log('inserting auto-generated users');
        const autoUsersColumns = ['user_id', 'full_name', 'auto_generated'];
        const autoUserRows = users.map(
            u => [u.user_id, u.full_name, 1]
        );
        const autoUsersInsertQuery = formatSqlInsertion('Users', autoUsersColumns, autoUserRows);
        await sql_promise_query(autoUsersInsertQuery);

        console.log('generating questions');
        const lorem = new LoremIpsum({
            sentencesPerParagraph: { max: 3, min: 2 },
            wordsPerSentence: { max: 10, min: 4 }
        });
        function randomSemesterDate() {
            var now = new Date();
            var semester_start = new Date('January 16, 2022');
            return datePickInRange(now, semester_start);
        }

        const questionInsertCols = ['question_id', 'user_id', 'course_id', 'title', 'body', 'created_at'];
        const autoQuestions = {};
        const questionInsertRows = [];
        for (var qid = 0; qid < num_questions; qid++) {

            const user = Math.randomPick(users);
            const course = Math.randomPick(courses);

            const title = lorem.generateWords(3) + "?";
            const body = lorem.generateParagraphs(2);
            const created_at = randomSemesterDate();

            const q = {
                user_id: user.user_id, 
                course_id: course.course_id, 
                title,
                body,
                created_at: created_at.toISOString(),
            };
            autoQuestions[qid] = q;
            const questionRow = [qid, q.user_id, q.course_id, q.title, q.body, formatSqlDate(created_at)];
            questionInsertRows.push(questionRow);
        }
        console.log('inserting auto questions');
        const questionInsertQuery = formatSqlInsertion('Questions', questionInsertCols, questionInsertRows);
        await sql_promise_query(questionInsertQuery);

        console.log('generating auto answers');

        // return x random, distinct integers in the range [0..n]
        function randomSubsetInRange(n, x) {
            const a = Array.from({length: n}, (e,i) => i);
            while (a.length > x) {
                randIndex = Math.randomInt(a.length);
                a.splice(randIndex, 1);
            }
            return a;
        }

        function sampleNormalRandomUser() {
            const dist = gaussian(
                answers_author_sample_mean, 
                answers_author_sample_var
            );
            var sample = dist.ppf(Math.random());
            sample = Math.floor(sample);
            sample = Math.min(sample, max_users);
            sample = Math.max(sample, 0);
            return users[sample];
        }

        function generateAnswerInsertQuery(answer_type, answers_count) {
            const answerInsertCols = ['question_id', 'user_id', 'answer_type', 'body', 'created_at'];
            const answerInsertRows = new Array();

            const questionsToAnswer = randomSubsetInRange(num_questions-1, answers_count);
            for (let i = 0; i < questionsToAnswer.length; i++) {
                const question_id = questionsToAnswer[i];

                const courseInstructors = instructors.filter(instr => (instr.course_id == autoQuestions[question_id].course_id));

                const user = (answer_type == 'student') 
                ? sampleNormalRandomUser()
                : Math.randomPick(courseInstructors);

                const body = lorem.generateParagraphs(1);

                const then = new Date(autoQuestions[question_id].created_at);
                const dayInMS = (1000 * 60 * 60 * 24);
                const aCoupleDaysLater = new Date(then.getTime() + (2*dayInMS));
                const created_at = datePickInRange(then, aCoupleDaysLater);

                // console.log(question_id+1);
                answerInsertRows.push([question_id+1, user.user_id, answer_type, body, formatSqlDate(created_at)]);
            }
            return formatSqlInsertion('Answers', answerInsertCols, answerInsertRows);
        }

        console.log('inserting auto student answers');
        const studentAnswerInsertQuery = 
            generateAnswerInsertQuery('student', num_student_answers);
        await sql_promise_query(studentAnswerInsertQuery);

        console.log('inserting auto instructor answers');
        const instructorAnswerInsertQuery = 
            generateAnswerInsertQuery('instructor', num_instructor_answers);
        await sql_promise_query(instructorAnswerInsertQuery);

        console.log('data generated.')
        return;

    } catch(error) {
        console.error(error);
    }
})()// db.query();

