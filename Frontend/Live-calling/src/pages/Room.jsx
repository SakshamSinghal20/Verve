import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { socket } from "../App";
import * as mediasoupClient from "mediasoup-client";

function Room() {
    const { roomId } = useParams();

    const deviceRef = useRef(null);
    const rtpCapabilitiesRef = useRef(null);

    useEffect(() => {
        console.log("Joined room:", roomId);

        socket.on("router-rtp-capabilities", async (data) => {
            console.log("RTP Capabilities:", data);

            rtpCapabilitiesRef.current = data;

            const device = new mediasoupClient.Device();

            await device.load({
                routerRtpCapabilities: data,
            });

            deviceRef.current = device;

            console.log("Device loaded");
        });

        return () => {
            socket.off("router-rtp-capabilities");
        };
    }, [roomId]);

    return (
        <div>
            <h2>Room: {roomId}</h2>
        </div>
    );
}

export default Room;