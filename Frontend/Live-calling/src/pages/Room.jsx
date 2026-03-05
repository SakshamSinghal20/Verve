import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";

function Room() {
    const { roomId } = useParams();
    const videoRef = useRef(null);

    useEffect(() => {
        const getMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });

                videoRef.current.srcObject = stream;

            } catch (error) {
                console.error("Error accessing media devices", error);
            }
        };

        getMedia();
    }, []);

    return (
        <div>
            <h2>Room: {roomId}</h2>

            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: "400px" }}
            />

        </div>
    );
}

export default Room;