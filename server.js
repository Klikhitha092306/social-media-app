const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const multer = require("multer");
const path = require("path");
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Likhi23@09",
    database: "social_media"
});

db.connect((err) => {
    if (err) {
        console.log("Database connection failed");
        console.log(err);
    } else {
        console.log("Connected to MySQL Database");
    }
});
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "public/uploads/");
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

app.post("/register", (req, res) => {
    const { username, interests } = req.body;

    if (!username) {
        return res.json({ message: "Username is required" });
    }

    const sql = "INSERT INTO users (username, interests) VALUES (?, ?)";

    db.query(sql, [username, interests], (err) => {
        if (err) {
            console.log(err);
            return res.json({ message: "Error inserting user" });
        }

        res.json({ message: "User registered successfully" });
    });
});

app.post("/create-post", upload.single("image"), (req, res) => {
    const username = req.body.username;
    const content = req.body.content;

    if (!username || !content) {
        return res.json({ message: "Username and content are required" });
    }

    const image = req.file ? req.file.filename : null;

    const getUserSql = "SELECT interests FROM users WHERE username = ?";

    db.query(getUserSql, [username], (err, userResult) => {

        if (err || userResult.length === 0) {
            return res.json({ message: "User not found" });
        }

        const userInterests = userResult[0].interests;

        const sql = "INSERT INTO posts (username, content, interests, image) VALUES (?, ?, ?, ?)";

        db.query(sql, [username, content, userInterests, image], (err) => {
            if (err) {
                console.log(err);
                return res.json({ message: "Error creating post" });
            }

            res.json({ message: "Post created successfully" });
        });

    });
});
app.get("/feed/:username", (req, res) => {
    const username = req.params.username;

    const getUser = "SELECT interests FROM users WHERE username = ?";

    db.query(getUser, [username], (err, userResult) => {
        if (err) return res.json({ message: "Error fetching user" });

        if (userResult.length === 0) {
            return res.json({ message: "User not found" });
        }

        const userInterests = userResult[0].interests.split(",");

        const getPosts = "SELECT * FROM posts ORDER BY created_at DESC";

        db.query(getPosts, (err, posts) => {
            if (err) return res.json({ message: "Error fetching posts" });

            const filteredPosts = posts.filter(post => {
                const postInterests = post.interests.split(",");
                return postInterests.some(interest =>
                    userInterests.includes(interest)
                );
            });

            res.json(filteredPosts);
        });
    });
});
app.post("/toggle-like", (req, res) => {
    const { post_id, username } = req.body;

    const checkSql = "SELECT * FROM likes WHERE post_id = ? AND username = ?";

    db.query(checkSql, [post_id, username], (err, result) => {
        if (err) return res.json({ message: "Error checking like" });

        if (result.length > 0) {
            // Unlike
            const deleteSql = "DELETE FROM likes WHERE post_id = ? AND username = ?";
            db.query(deleteSql, [post_id, username], () => {
                res.json({ liked: false });
            });
        } else {
            // Like
            const insertSql = "INSERT INTO likes (post_id, username) VALUES (?, ?)";
            db.query(insertSql, [post_id, username], () => {
                res.json({ liked: true });
            });
        }
    });
});
app.get("/like-count/:post_id", (req, res) => {
    const post_id = req.params.post_id;

    const sql = "SELECT COUNT(*) AS count FROM likes WHERE post_id = ?";

    db.query(sql, [post_id], (err, result) => {
        if (err) return res.json({ count: 0 });

        res.json({ count: result[0].count });
    });
});
app.post("/toggle-follow", (req, res) => {
    const { follower, following } = req.body;

    if (follower === following) {
        return res.json({ message: "Cannot follow yourself" });
    }

    const checkSql = "SELECT * FROM follows WHERE follower = ? AND following = ?";

    db.query(checkSql, [follower, following], (err, result) => {
        if (err) return res.json({ message: "Error checking follow" });

        if (result.length > 0) {
            // Unfollow
            const deleteSql = "DELETE FROM follows WHERE follower = ? AND following = ?";
            db.query(deleteSql, [follower, following], () => {
                res.json({ following: false });
            });
        } else {
            // Follow
            const insertSql = "INSERT INTO follows (follower, following) VALUES (?, ?)";
            db.query(insertSql, [follower, following], () => {
                res.json({ following: true });
            });
        }
    });
});
app.get("/following/:username", (req, res) => {
    const username = req.params.username;

    const sql = "SELECT following FROM follows WHERE follower = ?";

    db.query(sql, [username], (err, result) => {
        if (err) return res.json([]);

        const followingList = result.map(row => row.following);
        res.json(followingList);
    });
});
app.get("/home-feed/:username", (req, res) => {
    const username = req.params.username;

    const followingSql = "SELECT following FROM follows WHERE follower = ?";

    db.query(followingSql, [username], (err, followResult) => {
        if (err) return res.json([]);

        const followingList = followResult.map(row => row.following);

        if (followingList.length === 0) {
            return res.json([]);
        }

        const postsSql = `
            SELECT * FROM posts
            WHERE username IN (?)
            ORDER BY created_at DESC
        `;

        db.query(postsSql, [followingList], (err, posts) => {
            if (err) return res.json([]);

            res.json(posts);
        });
    });
});
app.get("/is-following/:follower/:following", (req, res) => {
    const { follower, following } = req.params;

    const sql = "SELECT * FROM follows WHERE follower = ? AND following = ?";

    db.query(sql, [follower, following], (err, result) => {
        if (err) return res.json({ following: false });

        res.json({ following: result.length > 0 });
    });
});
app.listen(5000, () => {
    console.log("Server started on port 5000");
});