var express = require('express');
var router = express.Router();
var config = require('../config/config.js');
var mysql = require('mysql');
var bcrypt = require('bcrypt-nodejs');
// var loggedIn;

var connection = mysql.createConnection(config.db);

connection.connect((error)=>{
	if(error){
		throw error;
	}
});

/* GET home page. */
router.get('/', function(req, res, next) {
	var message = req.query.msg;
	if(req.session.name == undefined){
		res.redirect('/login?msg=mustlogin');
		// console.log(`Welcome, ${req.session.name}`);
	}
	// Make a promise to handle JS asynchrony
	const getBands = new Promise((resolve, reject)=>{
		// Only get bands user has not voted on
		var selectSpecificBands = `
			SELECT * FROM bands WHERE id NOT IN(
 				SELECT imageID FROM votes WHERE userID = ?
 			);
		`;
		connection.query(selectSpecificBands, [req.session.uid], (error, results)=>{
			if(error){
				reject(error)
			}else{
				if(results.length == 0){
					// user has voted for everyone
					resolve("done");
				}else{
					var rand = Math.floor(Math.random() * results.length);
					resolve(results[rand]);
				}
			}
		});
	});

	getBands.then((bandObj)=>{
		if(bandObj == 'done'){
			// out of bands
			res.redirect('/standings?msg=complete');
		}else{
			console.log(bandObj);
			res.render('index', {
				name: req.session.name,
				band: bandObj,
				message: message,
				loggedIn: true
			});
		}
	});
});

router.get('/register', (req, res, next)=>{
	if(req.session.name != undefined){
		res.redirect('/?msg=alreadyLoggedIn');
	}else{
		res.render('register', { message:req.query.msg });
	}
});

router.post('/registerProcess', (req, res, next)=>{
	// res.json(req.body);
	var name = req.body.name;
	var email = req.body.email;
	var password = req.body.password;
	var selectQuery = `SELECT * FROM users WHERE email = ?;`;
	connection.query(selectQuery, [email], (error, results)=>{
		if(results.length != 0){
			res.redirect('/register?msg=registered');
		}else{
			var hash = bcrypt.hashSync(password);
			var insertQuery = `INSERT INTO users (name, email, password) VALUES (?, ?, ?);`;
			connection.query(insertQuery, [name, email, hash], (error)=>{ // We're not interested in results and fields
				if(error){
					throw error;
				}else{
					res.redirect('/?msg=registered')
				}
			});
		}
	});
});

router.get('/login', (req, res, next)=>{
	if(req.session.name != undefined){
		res.redirect('/?msg=alreadyLoggedIn');
	}else{
		res.render('login', {});
	}
});

router.post('/loginProcess', (req, res, next)=>{
	// res.json(req.body);
	var email = req.body.email;
	var password = req.body.password;

	var selectQuery = `SELECT * FROM users WHERE email = ?;`;
	connection.query(selectQuery, [email], (error, results)=>{
		if(error){
			throw error;
		}else{
			if(results.length == 0){
				// not in DB, so we don't care about the password
				res.redirect('/register?msg=badUser');
			}else{
				// our selectQuery found something! check the password with compareSync...
				var passwordsMatch = bcrypt.compareSync(password, results[0].password);
				if(passwordsMatch){
					// user in DB, password is legit, log them in...
					var row = results[0];
					req.session.name = row.name;
					req.session.uid = row.id;
					req.session.email = row.email;
					res.redirect('/');
				}else{
					// user in DB, but bad password, send back to login
					res.redirect('/login?msg=badPass');
				}
			}
		}
	});
});

router.get('/logout', (req, res)=>{
	req.session.destroy();
	res.redirect('/login');
});

router.get('/vote/:direction/:bandId', (req, res, next)=>{
	// res.json(req.params);
	var bandId = req.params.bandId;
	var direction = req.params.direction;
	var insertVoteQuery = `INSERT INTO votes (imageID, voteDirection, userID) VALUES (?, ?, ?);`;
	connection.query(insertVoteQuery, [bandId, direction, req.session.uid], (error, results)=>{
		if(error){
			throw error;
		}else{
			res.redirect('/');
		}
	});
});

router.get('/standings', (req, res)=>{
	const standingsQuery = `
		SELECT bands.title, bands.imageUrl, imageID, SUM(IF(voteDirection = 'up', 1, 0)) AS upVotes, SUM(IF(voteDirection = 'down', 1, 0)) AS downVotes, SUM(IF(voteDirection = 'up', 1, -1)) AS total FROM votes
 			INNER JOIN bands ON votes.imageID = bands.id
 			GROUP BY imageID;
	`;
	connection.query(standingsQuery, (error, results)=>{
		if(error){
			throw error;
		}else{
			res.render('standings', {
				standingsResults: results
			});
		}
	})
});

module.exports = router;