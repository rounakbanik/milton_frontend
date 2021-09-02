import * as React from "react";
import { ethers } from "ethers";
import './App.css';
import abi from './contracts/Milton.json';
import PostForm from "./components/PostForm";
import PostList from "./components/PostList";
import { archivePosts } from "./archives/data";

// Contract variables
const contractAddress = '0x2919EA0521354325B1260287F8bb914A283815e3';
const contractABI = abi.abi;

export default function App() {

  const [currentAccount, setCurrentAccount] = React.useState(null);
  const [postView, setPostView] = React.useState(false);
  const [postStatus, setPostStatus] = React.useState(null);
  const [posts, setPosts] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const checkIfWalletIsConnected = async () => {
    const { ethereum } = window;

    if (!ethereum) {
      console.log("Make sure you have Metamask installed!");
      return;
    } else {
      console.log("Wallet exists! We're ready to go!")
    }

    const accounts = await ethereum.request({ method: 'eth_accounts' });

    if (accounts.length !== 0) {
      const account = accounts[0];
      console.log("Found an authorized account: ", account);
      setCurrentAccount(account);
    } else {
      console.log("No authorized account found");
    }
  }

  const connectWallet = async () => {
    const { ethereum } = window;

    if (!ethereum) {
      console.log("Please install Metamask!");
    }

    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      console.log("Found an account! Address: ", accounts[0]);
      setCurrentAccount(accounts[0]);
      getAllPosts();

    } catch (err) {
      console.log(err)
    }
  }

  const cleanPostList = (postList) => {
    let newPosts = postList.map(post => {
      return {
        title: post.title,
        url: post.url,
        description: post.description,
        category: post.category,
        timestamp: new Date(post.timestamp * 1000),
        winner: post.winner,
      }
    });

    newPosts.reverse();
    return newPosts;
  }

  const getAllPosts = React.useCallback(async () => {

    setIsLoading(true);
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();

    const miltonContract = new ethers.Contract(contractAddress, contractABI, signer);

    let resultPosts = await miltonContract.getAllPosts();
    console.log(resultPosts);
    let cleanPosts = resultPosts.map(post => {
      return {
        title: post.title,
        url: post.url,
        description: post.description,
        category: post.category,
        timestamp: new Date(post.timestamp * 1000),
        winner: post.winner,
      }
    })

    cleanPosts.reverse();

    let cleanArchivePosts = archivePosts.map(post => ({ ...post, timestamp: new Date(post.timestamp) }));

    setPosts([...cleanPosts, ...cleanArchivePosts]);
    setIsLoading(false);

  }, []);

  const createPost = async ({ title, url, description, category }) => {

    // Begin mining
    setPostView(false);
    setPostStatus('mining');

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();

    const miltonContract = new ethers.Contract(contractAddress, contractABI, signer);

    let posts = await miltonContract.getAllPosts();
    console.log("The total number of posts is", posts.length);

    let postTxn;

    try {
      postTxn = await miltonContract.createPost(title, category, url, description);
      console.log("Mining... -", postTxn.hash);

      await postTxn.wait();
      console.log("Mined- ", postTxn.hash);

      posts = await miltonContract.getAllPosts();
      console.log("The total number of posts is", posts.length);

      //let newPost = { title, url, category, description, timestamp: new Date() }

      //setPosts(prevState => [newPost, ...prevState]);
      setPosts(cleanPostList(posts));

      setPostStatus('success');
    } catch (err) {
      setPostStatus('error');
    }

  }

  const postViewHandler = (e) => {
    console.log('Hit it!');
    setPostView(true);
    setPostStatus(null);
  }

  const cancelPostHandler = () => {
    setPostView(false);
  }

  React.useEffect(() => {
    checkIfWalletIsConnected();
    getAllPosts();
  }, [getAllPosts]);

  return (
    <div className="mainContainer">

      <div className="dataContainer">
        <div className="header">
          <h1> <span role='img' aria-label='logo'>🦁 </span> Milton</h1>
          <h2> A Decentralized Reddit </h2>
        </div>

        <div className="bio">
          Create posts, add links, tag categories, and preserve your ideas on the Ethereum blockchain for posterity.
        </div>

        {currentAccount && !postView && postStatus !== 'mining' && <button className="postButton" onClick={postViewHandler}>
          Create a Post
        </button>}
        {!currentAccount && <button className="postButton connectButton" onClick={connectWallet}>
          Connect Wallet
        </button>}
        {currentAccount && postView && <PostForm onCancel={cancelPostHandler}
          onFormSubmit={createPost} />}
        {!postView && <div className='post-submission'>
          {postStatus === 'success' && <div className={postStatus}>
            <p>Post successful!</p>
          </div>}
          {postStatus === 'mining' && <div className={postStatus}>
            <div className='loader' />
            <span>Transaction is mining</span>
          </div>}
          {postStatus === 'error' && <div className={postStatus}>
            <p>Transaction failed. Please try again.</p>
          </div>}
        </div>}
      </div>

      {isLoading && currentAccount && <div className='post-loader' />}
      {currentAccount && !isLoading && <PostList posts={posts} />}
    </div>
  );
}
