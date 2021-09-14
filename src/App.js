import * as React from "react";
import { ethers } from "ethers";
import './App.css';
import abi from './contracts/Milton.json';
import PostForm from "./components/PostForm";
import PostList from "./components/PostList";
import { archivePosts } from "./archives/data";
import { AlchemyProvider } from "@ethersproject/providers";

const cleanArchivePosts = archivePosts.map(post => ({ ...post, timestamp: new Date(post.timestamp) }));

// Contract variables
const contractAddress = '0xC5D38A26B2b28f97D2C738B3ea423De4Dc538d9b';
const contractABI = abi.abi;

export default function App() {

  const [currentAccount, setCurrentAccount] = React.useState(null);
  const [postView, setPostView] = React.useState(false);
  const [postStatus, setPostStatus] = React.useState(null);
  const [posts, setPosts] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [metamaskError, setMetamaskError] = React.useState(null);

  const checkIfWalletIsConnected = async () => {
    const { ethereum } = window;

    if (!ethereum) {
      console.log("Make sure you have Metamask installed!");
      return;
    } else {
      console.log("Wallet exists! We're ready to go!")
    }

    const accounts = await ethereum.request({ method: 'eth_accounts' });
    const network = await ethereum.request({ method: 'eth_chainId' });

    if (accounts.length !== 0 && network.toString() === '0x4') {
      const account = accounts[0];
      console.log("Found an authorized account: ", account);
      setMetamaskError(false);
      setCurrentAccount(account);
    } else {
      setMetamaskError(true);
      console.log("No authorized account found");
    }
  }

  const connectWallet = async () => {
    const { ethereum } = window;

    if (!ethereum) {
      console.log("Please install Metamask!");
    }

    try {
      const network = await ethereum.request({ method: 'eth_chainId' });

      if (network.toString() === '0x4') {
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        console.log("Found an account! Address: ", accounts[0]);
        setMetamaskError(null);
        setCurrentAccount(accounts[0]);
      }

      else {
        setMetamaskError(true);
      }


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

    // Use user account if it is connected to Rinkeby, else use default Alchemy Provider
    let signer;

    if (currentAccount) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      signer = provider.getSigner();
    }
    else {
      signer = new AlchemyProvider('rinkeby')
    }

    const miltonContract = new ethers.Contract(contractAddress, contractABI, signer);

    let resultPosts = await miltonContract.getAllPosts();

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

    setPosts([...cleanPosts, ...cleanArchivePosts]);
    setIsLoading(false);

  }, [currentAccount]);

  const createPost = async ({ title, url, description, category }) => {

    // Begin mining
    setPostView(false);
    setPostStatus('mining');

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();

    const miltonContract = new ethers.Contract(contractAddress, contractABI, signer);

    let posts = await miltonContract.getAllPosts();

    let postTxn;

    try {
      postTxn = await miltonContract.createPost(title, category, url, description);
      console.log("Mining... -", postTxn.hash);

      await postTxn.wait();
      console.log("Mined- ", postTxn.hash);

      posts = await miltonContract.getAllPosts();

      setPosts([...cleanPostList(posts), ...cleanArchivePosts]);

      setPostStatus('success');
    } catch (err) {
      setPostStatus('error');
    }

  }

  const postViewHandler = (e) => {
    setPostView(true);
    setPostStatus(null);
  }

  const cancelPostHandler = () => {
    setPostView(false);
  }

  React.useEffect(() => {
    checkIfWalletIsConnected();
    getAllPosts();

    if (window.ethereum) {
      window.ethereum.on('chainChanged', (_chainId) => window.location.reload());
    }

  }, [getAllPosts]);

  return (
    <React.Fragment>
      {metamaskError && <div className='metamask-error'>Please make sure you are connected to the Rinkeby Network on Metamask!</div>}
      <div className="mainContainer">

        <div className="dataContainer">
          <div className="header">
            <h1> <span role='img' aria-label='logo'>🦁 </span> Milton</h1>
            <h2> A Decentralized Reddit </h2>
          </div>

          <div className="bio">
            Create posts, add links, tag categories, and preserve your ideas on the Ethereum blockchain for posterity.
          </div>

          <div className='offer'>Limited time offer: Win 0.0001 ETH for posting!</div>

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

        {isLoading && <div className='post-loader' />}
        {!isLoading && <PostList posts={posts} />}
      </div>
    </React.Fragment>
  );
}
