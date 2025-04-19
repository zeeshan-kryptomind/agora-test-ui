import React, { useEffect, useRef, useState } from "react";
import AgoraRTC, { IAgoraRTCRemoteUser, ILocalTrack } from "agora-rtc-sdk-ng";

const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

type Role = "tutor" | "student";

export default function App() {
  const [uid, setUid] = useState("");
  const [token, setToken] = useState("");
  const [channel, setChannel] = useState("");
  const [role, setRole] = useState<Role>("student");

  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [remoteUser, setRemoteUser] = useState<IAgoraRTCRemoteUser | null>(
    null
  );

  const localAudioTrack = useRef<ILocalTrack | null>(null);
  const localVideoTrack = useRef<ILocalTrack | null>(null);

  const localContainer = useRef<HTMLDivElement | null>(null);
  const remoteContainer = useRef<HTMLDivElement | null>(null);

  const handleJoin = async () => {
    if (!uid || !token || !channel) {
      alert("Please fill in all fields");
      return;
    }

    await client.join(import.meta.env.VITE_AGORA_APP_ID, channel, token, uid);

    localAudioTrack.current = await AgoraRTC.createMicrophoneAudioTrack();
    localVideoTrack.current = await AgoraRTC.createCameraVideoTrack();

    await client.publish([localAudioTrack.current, localVideoTrack.current]);

    // if (localContainer.current && localVideoTrack.current) {
    //   localVideoTrack.current.play(localContainer.current);
    // }

    setTimeout(() => {
      if (localVideoTrack.current && localContainer.current) {
        localVideoTrack.current.play(localContainer.current);
      }
    }, 500);

    console.log("Local video track:", localVideoTrack.current);
    console.log("Local container:", localContainer.current);

    setMicOn(true);
    setCamOn(true);
    setJoined(true);
  };

  const handleLeave = async () => {
    localAudioTrack.current?.close();
    localVideoTrack.current?.close();
    await client.leave();
    setJoined(false);
    setRemoteUser(null);
  };

  const toggleMic = async () => {
    if (!localAudioTrack.current) return;
    const enabled = localAudioTrack.current.enabled;
    await localAudioTrack.current.setEnabled(!enabled);
    setMicOn(!enabled);
  };

  const toggleCam = async () => {
    if (!localVideoTrack.current) return;
    const enabled = localVideoTrack.current.enabled;
    await localVideoTrack.current.setEnabled(!enabled);
    setCamOn(!enabled);
  };

  useEffect(() => {
    if (joined && localVideoTrack.current && localContainer.current) {
      localVideoTrack.current.play(localContainer.current);
    }
  }, [joined]);

  useEffect(() => {
    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);

      setRemoteUser(user);

      if (mediaType === "video") {
        // Wait for video track to exist
        if (remoteContainer.current) {
          const playerId = `remote-player-${user.uid}`;
          let player = document.getElementById(playerId);

          if (!player) {
            player = document.createElement("div");
            player.id = playerId;
            player.className = "w-64 h-48 bg-black mb-2";
            remoteContainer.current.innerHTML = "";
            remoteContainer.current.append(player);
          }

          // Ensure video track is ready
          if (user.videoTrack) {
            try {
              user.videoTrack.play(player as HTMLElement);
            } catch (err) {
              console.warn("Error playing remote video:", err);
            }
          }
        }
      }

      if (mediaType === "audio") {
        user.audioTrack?.play();
      }
    });

    client.on("user-unpublished", (user, mediaType) => {
      if (mediaType === "video") {
        const player = document.getElementById(`remote-player-${user.uid}`);
        if (player) player.remove();
      }
      if (mediaType === "audio") {
        user.audioTrack?.stop();
      }
      setRemoteUser(null);
    });
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Agora Video Meeting</h1>

      {!joined ? (
        <div className="space-y-4 mb-6">
          <TextInput label="UID" value={uid} onChange={setUid} />
          <TextInput label="Token" value={token} onChange={setToken} />
          <TextInput label="Channel" value={channel} onChange={setChannel} />
          <SelectInput label="Role" value={role} onChange={setRole} />
          <button
            onClick={handleJoin}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
          >
            Join Meeting
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-6">
            <VideoStream title={`Local (${uid})`} refObj={localContainer} />
            <VideoStream title="Remote" refObj={remoteContainer} />
          </div>

          <div className="flex gap-4 mt-4">
            <button
              onClick={toggleMic}
              className={`px-4 py-2 rounded ${
                micOn ? "bg-red-500" : "bg-blue-500"
              } text-white`}
            >
              {micOn ? "Mute Mic" : "Unmute Mic"}
            </button>
            <button
              onClick={toggleCam}
              className={`px-4 py-2 rounded ${
                camOn ? "bg-red-500" : "bg-blue-500"
              } text-white`}
            >
              {camOn ? "Turn Off Cam" : "Turn On Cam"}
            </button>
            <button
              onClick={handleLeave}
              className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded"
            >
              Leave
            </button>
          </div>

          {/* Uncomment for Tutor remote control */}
          {/*
          {role === "tutor" && remoteUser && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Remote Control (Student)</h3>
              <div className="flex gap-4">
                <button
                  onClick={() => remoteUser.audioTrack?.setEnabled(false)}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded"
                >
                  Mute Student
                </button>
                <button
                  onClick={() => remoteUser.audioTrack?.setEnabled(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                >
                  Unmute Student
                </button>
                <button
                  onClick={() => remoteUser.videoTrack?.setEnabled(false)}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded"
                >
                  Turn Off Student Cam
                </button>
                <button
                  onClick={() => remoteUser.videoTrack?.setEnabled(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                >
                  Turn On Student Cam
                </button>
              </div>
            </div>
          )}
          */}
        </div>
      )}
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="flex flex-col">
      <label className="font-medium">{label}</label>
      <input
        className="border px-3 py-2 rounded w-60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${label}`}
      />
    </div>
  );
}

function SelectInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: "student" | "tutor") => void;
}) {
  return (
    <div className="flex flex-col">
      <label className="font-medium">{label}</label>
      <select
        className="border px-3 py-2 rounded w-60"
        value={value}
        onChange={(e) => onChange(e.target.value as Role)}
      >
        <option value="tutor">Tutor</option>
        <option value="student">Student</option>
      </select>
    </div>
  );
}

function VideoStream({
  title,
  refObj,
}: {
  title: string;
  refObj: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div>
      <h2 className="font-semibold mb-1">{title}</h2>
      <div ref={refObj} className="w-64 h-48 bg-black rounded" />
    </div>
  );
}
