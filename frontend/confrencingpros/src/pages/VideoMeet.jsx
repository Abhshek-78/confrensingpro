import React, { useEffect, useState, useRef } from 'react';
import '../styles/Videomeet.css';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';

export default function VideoMeet() {
  const { url } = useParams();
  
  // Use URL as room ID so multiple users can join with same link
  const roomId = url || `room_${Math.random().toString(36).substr(2, 9)}`;
  const Servr_url = "http://localhost:8000";

  const peerconnectionConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }
    ]
  };

  var connection = {};
  var socketRef = useRef();
  let socketIdRef = useRef();
  let localvideoRef = useRef();

  let [videoAvalable, SetVideoavAlable] = useState(true);
  let [audioAvalible, SetAudioAvalible] = useState(true);

  let [Video, SetVideo] = useState(true);  // Default to true for video
  let [Audio, SetAudio] = useState(true);  // Default to true for audio

  let [Screen, setScreen] = useState();
  let [showModal, setModal] = useState();
  let [screenAvailavle, setScreenAvailable] = useState();

  let [messages, setMessages] = useState([]);
  let [message, setMessage] = useState("");
  let [NewMessage, setNewMessage] = useState(0);

  let [askforUsername, setaskForUsername] = useState(true);
  let [username, setUsername] = useState("");
  let [permissionGranted, setPermissionGranted] = useState(false);

  const videoRef = useRef([]);
  let [videos, setVideos] = useState([]);

 
  const getPermissions = async () => {
    try {
      const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true });
      SetVideoavAlable(!!videoPermission);

      const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true });
      SetAudioAvalible(!!audioPermission);

      if (navigator.mediaDevices.getDisplayMedia) {
        setScreenAvailable(true);
      } else {
        setScreenAvailable(false);
      }

      const userMediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      if (userMediaStream) {
        window.localStream = userMediaStream;
        setPermissionGranted(true);

        if (localvideoRef.current) {
          localvideoRef.current.srcObject = userMediaStream;
        }
      }

    } catch (error) {
      console.error("Error accessing media devices:", error);
      setPermissionGranted(false);
    }
  };

  useEffect(() => {
    getPermissions();
  }, []);
  let silence=()=>{
    let ctx=new AudioContext()
    let osilator=ctx.createOscillator();
    let dst=osilator.connect(ctx.createMediaStreamDestination);
    osilator.start();
    ctx.resume();
    return  Object.assign(dst.stream.getAudioTrack()[0],{enabled:false})
  }
  let  black=({width=640,height=480}={})=>{
    let canvas=Object.assign(document.createElement("canvas"),{width,height});
    canvas.getContext('2d').fillRect(0,0,width,height);
    let stream=canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0],{enabled:false})
  }
  
  let getUserMedia = () => {
    // Both video and audio should be requested if both are available
    const constraints = {
      video: Video && videoAvalable ? true : false,
      audio: Audio && audioAvalible ? true : false
    };

    // Only proceed if at least one constraint is enabled
    if (!constraints.video && !constraints.audio) {
      try {
        let tracks = localvideoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      } catch (error) {
        console.log("Error stopping tracks:", error);
      }
      return;
    }

    navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => {
        window.localStream = stream;

        if (localvideoRef.current) {
          localvideoRef.current.srcObject = stream;
        }
        
        // Enable all tracks
        stream.getTracks().forEach(track => {
          track.enabled = true;
          console.log(`${track.kind} track enabled:`, track.enabled);
        });
      })
      .catch((e) => console.error("getUserMedia error:", e));
  };

  let getUserMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach(track => track.stop());
    } catch (e) {
      console.log(e);
    }
    window.localStream = stream;
    localvideoRef.current.srcObject = stream;
    for (let id in connection) {
      if (id === socketIdRef.current) continue;
      connection[id].addStream(window.localStream);
      connection[id].createOffer().then((description) => {
        connection[id].setLocalDescription(description)
          .then(() => {
            socketRef.current.emit("signal", id, JSON.stringify({ "sdp": connection[id].localDescription }));
          }).catch(e => console.log(e));
      });
    }
    stream.getTracks().forEach(track => {
      track.onended = () => {
        SetVideo(false);
        SetAudio(false);
        try {
          let tracks = localvideoRef.current.srcObject.getTracks();
          tracks.forEach(track => track.stop());
        } catch (e) {
          console.log(e);
        }
        let blackSlience = (...args) => new MediaStream([black(...args), silence()]);
        window.localStream = blackSlience();
        localvideoRef.current.srcObject = window.localStream;
        for (let id in connection) {
          connection[id].addStream(window.localStream);
          connection[id].createOffer().then((description) => {
            connection[id].setLocalDescription(description)
              .then(() => {
                socketRef.current.emit("signal", id, JSON.stringify({ "sdp": connection[id].localDescription }));
              }).catch(e => console.log(e));
          });
        }
      };
    });
  };

  useEffect(() => {
    if (Video !== undefined && Audio !== undefined) {
      getUserMedia();
    }
  }, [Audio, Video]);

  // ✅ Trigger media + connect
  let getMedia = () => {
    console.log("getMedia called - video available:", videoAvalable, "audio available:", audioAvalible);
    // Set states to trigger getUserMedia
    if (videoAvalable) SetVideo(true);
    if (audioAvalible) SetAudio(true);
    
    // Call connect after a short delay to ensure states are updated
    setTimeout(() => {
      connect();
    }, 300);
  };


  const gotoMessageFromServer = (fromId, message) => {
    // Handle incoming messages from server
    console.log("Message from:", fromId, "Content:", message);
  };

  let gotMessage = (fromId, message) => {
    var signal = JSON.parse(message);
    if (fromId !== socketIdRef.current) {
      if (signal.sdp) {
        if (!connection[fromId]) {
          connection[fromId] = new RTCPeerConnection(peerconnectionConfig);
          
          connection[fromId].onicecandidate = (event) => {
            if (event.candidate != null) {
              socketRef.current.emit("signal", fromId, JSON.stringify({ 'ice': event.candidate }));
            }
          };

          connection[fromId].ontrack = (event) => {
            console.log("Remote track received:", event);
            let videoExists = videoRef.current.find(video => video.socketId === fromId);
            
            if (videoExists) {
              setVideos(videos => {
                const updateVideos = videos.map(video =>
                  video.socketId === fromId ? { ...video, stream: event.streams[0] } : video
                );
                videoRef.current = updateVideos;
                return updateVideos;
              });
            } else {
              let newVideo = {
                socketId: fromId,
                stream: event.streams[0],
                autoPlay: true,
                playsInline: true,
              };
              setVideos(videos => {
                const updateVideos = [...videos, newVideo];
                videoRef.current = updateVideos;
                return updateVideos;
              });
            }
          };

          if (window.localStream) {
            window.localStream.getTracks().forEach(track => {
              connection[fromId].addTrack(track, window.localStream);
            });
          }
        }

        connection[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
          if (signal.sdp.type === "offer") {
            connection[fromId].createAnswer().then((description) => {
              connection[fromId].setLocalDescription(description).then(() => {
                socketRef.current.emit("signal", fromId, JSON.stringify({ "sdp": connection[fromId].localDescription }));
              }).catch(e => console.error("setLocalDescription error:", e));
            }).catch(e => console.error("createAnswer error:", e));
          }
        }).catch(e => console.error("setRemoteDescription error:", e));
      }
      
      if (signal.ice) {
        if (connection[fromId]) {
          connection[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log("ICE error:", e));
        }
      }
    }
  };

  const addMessage = () => {
    // Add message to messages state
    console.log("Message added:", message);
  };
  const connectToSocketServer = () => {
    socketRef.current = io.connect(Servr_url, { secure: false });

    socketRef.current.on('signal', gotMessage);

    socketRef.current.on('connect', () => {
      // Emit the room ID so all users in same room are connected
      socketRef.current.emit("join call", roomId);
      socketIdRef.current = socketRef.current.id;

      socketRef.current.on("chat message", addMessage);

      socketRef.current.on("user left", (id) => {
        setVideos((video) => video.filter((video) => video.socketId !== id));
      });

      socketRef.current.on("user join", (id, client) => {
        client.forEach((socketListId) => {
          if (!connection[socketListId]) {
            connection[socketListId] = new RTCPeerConnection(peerconnectionConfig);
            
            connection[socketListId].onicecandidate = (event) => {
              if (event.candidate != null) {
                socketRef.current.emit("signal", socketListId, JSON.stringify({ 'ice': event.candidate }));
              }
            };

            // Use ontrack instead of deprecated onaddstream
            connection[socketListId].ontrack = (event) => {
              console.log("ontrack event received:", event);
              let videoExists = videoRef.current.find(video => video.socketId === socketListId);
              
              if (videoExists) {
                setVideos(videos => {
                  const updateVideos = videos.map(video =>
                    video.socketId === socketListId ? { ...video, stream: event.streams[0] } : video
                  );
                  videoRef.current = updateVideos;
                  return updateVideos;
                });
              } else {
                let newVideo = {
                  socketId: socketListId,
                  stream: event.streams[0],
                  autoPlay: true,
                  playsInline: true,
                };
                setVideos(videos => {
                  const updateVideos = [...videos, newVideo];
                  videoRef.current = updateVideos;
                  return updateVideos;
                });
              }
            };

            // Add local stream tracks to peer connection
            if (window.localStream !== undefined && window.localStream !== null) {
              window.localStream.getTracks().forEach(track => {
                connection[socketListId].addTrack(track, window.localStream);
              });
            }

            // Create offer for new connection
            connection[socketListId].createOffer().then((description) => {
              connection[socketListId].setLocalDescription(description)
                .then(() => {
                  socketRef.current.emit("signal", socketListId, JSON.stringify({ "sdp": connection[socketListId].localDescription }));
                })
                .catch(e => console.error("setLocalDescription error:", e));
            }).catch(e => console.error("createOffer error:", e));
          }
        });
      });
    });
  };

  const connect = () => {
    if (!username.trim()) {
      alert("Please enter a username");
      return;
    }
    console.log("Connecting as:", username, "Room:", roomId);
    
    // Get media first, then connect
    if (window.localStream && window.localStream.getTracks().length > 0) {
      // Already have stream, connect directly
      connectToSocketServer();
      setaskForUsername(false);
    } else {
      // Get media then connect
      getUserMedia();
      setTimeout(() => {
        connectToSocketServer();
        setaskForUsername(false);
      }, 500);
    }
  };

  return (
    <div>
      {askforUsername === true ? (
        <div className='containers'>
          <h2>Enter Meeting Room</h2>
          
          <div className="room-info">
            <p>Room ID: <span className="room-id">{roomId}</span></p>
          </div>

          <TextField
            label="Enter your username"
            variant="outlined"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="white-textfield"
          />

          <Button 
            variant="contained" 
            onClick={getMedia}
            className="connect-button"
            disabled={!permissionGranted}
          >
            {permissionGranted ? "Connect to Meeting" : "Requesting Permissions..."}
          </Button>

          <div className="video-preview-container">
            <video
              ref={localvideoRef}
              autoPlay
              muted
              playsInline
            />
          </div>
        </div>
      ) : (
        <div className="meeting-container">
          <div className="video-stream local-video-wrapper">
            <video ref={localvideoRef} autoPlay muted playsInline></video>
          </div>
          {videos.map((video) => {
            return (
              <div key={video.socketId} className="video-stream">
                <h2>{video.socketId.substring(0, 8)}...</h2>
                <video
                  data-socket={video.socketId}
                  ref={ref => {
                    if (ref && video.stream) {
                      ref.srcObject = video.stream;
                    }
                  }}
                  autoPlay
                ></video>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
