var express = require('express');
var router = express.Router();
var config = require('../config/config.js');
var mysql = require('mysql');
// var bcrypt = require('bcrypt-nodejs');

var connection = mysql.createConnection(config.db);
connection.connect((error)=>{
	console.log(error);
});

/* GET home page. */
router.get('/', function(req, res, next) {
	var selectQuery = "SELECT * FROM users;";
	connection.query(selectQuery, (error, results)=>{
		res.render('index', {
			users: results
		});
	});
});

module.exports = router;
