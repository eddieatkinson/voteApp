var express = require('express');
var router = express.Router();
var config = require('../config/config.js');
var mysql = require('mysql');
var bcrypt = require('bcrypt-nodejs');

var connection = mysql.createConnection(config.db);

connection.connect((error)=>{
	if(error){
		throw error;
	}
});

/* GET home page. */
router.get('/', function(req, res, next) {
	if(req.session.name != undefined){
		console.log(`Welcome, ${req.session.name}`);
	}

	// Make a promise to handle JS asynchrony
	const getBands = new Promise((resolve, reject)=>{
		// Go get the images
		var selectQuery = `SELECT * FROM bands;`;
		connection.query(selectQuery, (error, results)=>{
			if(error){
				reject(error)
			}else{
				var rand = Math.floor(Math.random() * results.length);
				resolve(results[rand]);
			}
		});
	});

	getBands.then((bandObj)=>{
		console.log(bandObj);
		res.render('index', {
			name: req.session.name,
			band: bandObj
		});
	});
	getBands.catch((error)=>{
		res.send(error.sqlMessage);
	});
});

router.get('/register', (req, res, next)=>{
	res.render('register', {});
});

router.post('/registerProcess', (req, res, next)=>{
	// res.json(req.body);
	var name = req.body.name;
	var email = req.body.email;
	var password = req.body.password;
	var selectQuery = "SELECT * FROM users WHERE email = ?;";
	connection.query(selectQuery, [email], (error, results)=>{
		if(results.length != 0){
			res.redirect('/register?msg=registered');
		}else{
			var hash = bcrypt.hashSync(password);
			var insertQuery = "INSERT INTO users (name, email, password) VALUES (?, ?, ?);";
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
	res.render('login', {});
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
				res.redirect('/login?msg=badUser');
			}else{
				// our selectQuery found something! check the password with compareSync...
				var passwordsMatch = bcrypt.compareSync(password, results[0].password);
				if(passwordsMatch){
					// user in DB, password is legit, log them in...
					var row = results[0];
					req.session.name = row.name;
					req.session.id = row.id;
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

module.exports = router;