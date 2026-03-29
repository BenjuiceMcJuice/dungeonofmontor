import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

var firebaseConfig = {
  apiKey: 'AIzaSyBWZq0sj_HddnzchM2W5aC9NW3sFM2xfng',
  authDomain: 'dungeon-of-montor-1dc89.firebaseapp.com',
  projectId: 'dungeon-of-montor-1dc89',
  storageBucket: 'dungeon-of-montor-1dc89.firebasestorage.app',
  messagingSenderId: '345848649218',
  appId: '1:345848649218:web:99d524cd4c0b83203b791b',
}

var app = initializeApp(firebaseConfig)
var auth = getAuth(app)
var db = getFirestore(app)
var googleProvider = new GoogleAuthProvider()

export { app, auth, db, googleProvider }
