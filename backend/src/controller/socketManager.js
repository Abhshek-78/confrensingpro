import { Server, Socket } from "socket.io";
let connections={};
let messages={};
let timeonline={};


export const connectToSocket=(server)=>{
    const io=new Server(server,{
        cors:{
            origin:"*",
            methods:["GET","POST"],
            allowedHeaders:["*"],
            credentials:true
        }
    });


    io.on("connecton",(socket)=>{
        socket.on("join-call",(path)=>{
            if(connections[path]===undefined){
                connections[path]=[]
            }
            connections[path].push(socket.id)
            timeonline[socket.id]=new Date();
            /*connections[path].array.forEach(element => {
                io.to(element)
            });*/
            for(let a=0;a<connections[path].length ;i++){
                io.to(connections[path][a]).emit("user-joined",socket.id,connections[path])
            }
            if(messages[path]!==undefined){
                for(let a=0;a<messages[path].length;++a){
                    io.to(socket.id).emit("chat-message",messages[path][a]['data'],
                        messages[path][a]['sender'],messages[path][a]['socket-id-sender']
                    )
                }
            }



        });
        socket.on("signal",(toId,message)=>{
            io.to(toId).emit("signal",socket.id,message);
        });
        socket.on("chat-message",(data,sender)=>{
            const [matchingRoom,fount]=Object.entries(connections)
                .reduce(([room,isFound,roomKey,roomValue])=>{
                    if(! isFound && roomValue.include(socket.id)){
                        return [roomKey,true];
                    }
                    return [room,roomFound]
                },['',false]);

            if(found===true){
                if(messages[matchingRoom]=== undefined){
                    messages[matchingRoom]=[]
                }
                message[matchingRoom].push({'sender':sender,'data':data,'socket-id-sender':socket.id})
                console.log("messages",key,":",sender,data)
                connections[matchingRoom].array.forEach(element => {
                    io.to(element).emit("chat-message",data,sender,socket.id)
                });
            }
        });
        socket.on("disconnect",()=>{
            var diffTime=Math.abs(timeonline[socket.id],- new Date())
            var key
            for(cont [key,v] of JSON.parse(JSON.stringify(Object.entries(connections)))){
                for(let a=0;a<v.length;++a){
                    if(v[a]===socket.id){
                        key=k
                        for(let a=0;a<connections[key].length;++a){
                            io.to(connections[key][a]).emit('user-left',socket.id)
                        }
                        var index=connections[key].splice(index,1)



                        if(connections[key].length===0){
                            delete connections[key ]
                        }
                    }

                }
            }
        })
    })
    


}
