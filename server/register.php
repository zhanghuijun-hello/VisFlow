<?php

include 'mysql.php';
include 'common.php';

if (!isset($_POST['username']))
  abort('username not set');

if (!isset($_POST['password']))
  abort('password not set');

if (!isset($_POST['email']))
  abort('email not set');

$username = $_POST['username'];
$password = $_POST['password'];
$email = $_POST['email'];

if (strlen($username) < $min_username_length)
  abort('username too short');

if (strlen($password) < $min_password_length)
  abort('password too short');

if (!preg_match('/^[a-z0-9_]+$/', $username))
  abort('invalid username');
if (!filter_var($email, FILTER_VALIDATE_EMAIL))
  abort('invalid email address');

$password = hash('sha256', $password);

connectDB();

// check for existing username
if (countDB("SELECT * FROM user WHERE username='%s'",
            array($username)))
  abort('username exists');

// check for existing email
if (countDB("SELECT * FROM user WHERE email='%s'",
            array($email)))
  abort('email exists');

// create user
queryDB("INSERT INTO user (username, password, email) VALUES ('%s', '%s', '%s')",
            array($username, $password, $email));

session_start([
  'cookie_lifetime' => 3600, // cookie time 1 hour
]);
$session_id = session_id();

$result = queryDB("SELECT id FROM user WHERE username='%s'",
            array($username));
$user_id = $result->fetch_assoc()['id'];

// add auth session
$end_time = date_timestamp_get(date_create()) + 3600; // +1 hour
queryDB("INSERT INTO auth (user_id, session_id, end_time) VALUES (%d, '%s', FROM_UNIXTIME(%d))",
       array($user_id, $session_id, $end_time));

status(200);
contentType('text');
echo $end_time;

?>
