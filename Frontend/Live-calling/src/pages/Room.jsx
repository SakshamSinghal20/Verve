import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import * as mediasoupClient from "mediasoup-client";

let device;
let producerTransport;
let producer;

function Room() {
    const { roomId } = useParams();
    const videoRef = useRef(null);

    useEffect(() => {
        const startMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });

                videoRef.current.srcObject = stream;
            } catch (err) {
                console.error("Media access error:", err);
            }
        };

        startMedia();
    }, []);

    return (
        <div>
            <h2>Room: {roomId}</h2>

            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                width="500"
            />
        </div>
    );
}

export default Room;