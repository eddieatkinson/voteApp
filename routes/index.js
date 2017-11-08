var express = require('express');
var router = express.Router();
var fs = require('fs'); // We need fs so we can read our multer file
var config = require('../config/config.js');
var mysql = require('mysql');
var bcrypt = require('bcrypt-nodejs');

var multer = require('multer');
// Tell multer where to save the files it gets
var uploadDir = multer({
	dest: 'public/images'
});
// Specify the name of the file input to accept
var nameOfFileField = uploadDir.single('imageToUpload');

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
			// console.log(bandObj);
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
	res.render('register', { message:req.query.msg });
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
	var insertVoteQuery = `INSERT INTO votes (imageID, voteDirection, userID, ip_address) VALUES (?, ?, ?, ?);`;
	connection.query(insertVoteQuery, [bandId, direction, req.session.uid, req.ip], (error, results)=>{
		if(error){
			throw error;
		}else{
			res.redirect('/');
		}
	});
});

router.get('/standings', (req, res)=>{
	if(req.session.name == undefined){
		loggedIn = false
	}else{
		loggedIn = true
	}
	const standingsQuery = `
		SELECT bands.title, bands.imageUrl, imageID, SUM(IF(voteDirection = 'up', 1, 0)) AS upVotes, SUM(IF(voteDirection = 'down', 1, 0)) AS downVotes, SUM(IF(voteDirection = 'up', 1, -1)) AS total FROM votes
 			INNER JOIN bands ON votes.imageID = bands.id
 			GROUP BY imageID ORDER BY upVotes desc;
	`;
	connection.query(standingsQuery, (error, results)=>{
		results.map((band, i)=>{
			if(band.upVotes / (band.upVotes + band.downVotes) > .8){
				results[i].cls = "top-rated"
			}else if(band.upVotes / (band.upVotes + band.downVotes) <= .5){
				results[i].cls = "worst-rated"
			}else{
				results[i].cls = "middle"
			}
		});
		if(error){
			throw error;
		}else{
			res.render('standings', {
				standingsResults: results,
				loggedIn: loggedIn
			});
		console.log(results);
		}
	});
});

router.get('/uploadBand', (req, res)=>{
	if(req.session.name == undefined){
		loggedIn = false;
		res.redirect('login')
	}else{
		loggedIn = true;
		res.render('upload', {loggedIn: loggedIn});
	}
});

router.post('/formSubmit', nameOfFileField, (req, res)=>{
	console.log(req.file);
	console.log(req.body);
	var tmpPath = req.file.path;
	var targetPath = `public/images/${req.file.originalname}`;
	fs.readFile(tmpPath, (error, fileContents)=>{
		if(error){
			throw error
		}
		fs.writeFile(targetPath, fileContents, (error)=>{
			if(error){
				throw error
			}
			var insertQuery = `
				INSERT INTO bands (imageUrl, title)
					VALUES
					(?, ?);`;
			connection.query(insertQuery, [req.file.originalname, req.body.bandName], (dbError)=>{
				if(dbError){
					throw dbError;
				}
				res.redirect('/');
			})
		});
	});
	// res.json(req.body);
});

module.exports = router;