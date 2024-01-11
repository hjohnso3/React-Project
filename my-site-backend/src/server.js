import fs from 'fs';
import admin from 'firebase-admin';
import express from 'express';
import { db, connectToDb } from './db.js'; // import resuable code to connect to db

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

const credentials = JSON.parse(
    fs.readFileSync('./credentials.json')
);
admin.initializeApp({
    credential: admin.credential.cert(credentials)
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../build'))); // tell express to use build as static folder

app.use(async (req, res, next) => {
    const { authtoken } = req.headers;

    if (authtoken) {
        try {
            const user = await admin.auth().verifyIdToken(authtoken);
            req.user = user;
        } catch (e) {
            return res.sendStatus(400);
        }
    }

    req.user = req.user || {};
    next();
});

//app.post('/hello', (req, res) => {
//    res.send(`Hello ${req.body.name}!`);
//});
//
//app.get('/hello/:personName', (req, res) => {
//  const { personName } = req.params;
//  res.send(`Hello ${personName}!!`);
//});

app.get('/api/articles/:articleName', async (req, res) => {
   const { articleName } = req.params;
   const { uid } = req.user;

   const article = await db.collection('articles').findOne({ articleName });

   if (article){
      const upvoteIds = article.upvoteIds || [];
      article.canUpvote = uid && !upvoteIds.includes(uid);
      res.json(article); // making sure we have the correct format of json being sent
   }else {
      res.sendStatus(404);
   }

 });

// The below code will prevent users from accessing endpoints (articles, upvotes etc) below if they are not logged in
app.use((req, res, next) => {
    if(req.user) {
        next();
    }  else {
        res.sendStatus(401);
    }
});

app.put('/api/articles/:articleName/upvote', async (req, res) => {
  const { articleName } = req.params;
  const { uid } = req.user;

  const article = await db.collection('articles').findOne({ articleName });

     if (article){
        const upvoteIds = article.upvoteIds || [];
        const canUpvote = uid && !upvoteIds.includes(uid);

        if (canUpvote) {
              await db.collection('articles').updateOne({ articleName }, {
                    $inc: { upvotes: 1 },
                    $push: { upvoteIds: uid }
              });
        }
          const updatedArticle = await db.collection('articles').findOne({ articleName });
          res.json(updatedArticle);
      } else {
        res.send('That article doesn\'t exist');
      }
});

app.post('/api/articles/:articleName/comments', async (req, res) => {
   const { text } = req.body;
   const { articleName } = req.params;
   const { email } = req.user;

    await db.collection('articles').updateOne({ articleName }, {
         $push: { comments: {postedBy: email, text} },
    });

   const article = await db.collection('articles').findOne({ articleName });

   if (article){
        res.json(article);
   } else {
        res.send('That article doesn\'t exist');
   }
});

connectToDb(() => { // connectToDb function from db.js
    console.log('Successfully connected to db');
    app.listen(8000, () => {
        console.log('Server is listening on port 8000');
    });

});