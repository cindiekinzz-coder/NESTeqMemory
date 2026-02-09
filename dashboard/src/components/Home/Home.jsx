import { useState, useEffect } from 'react';
import { getHome, getLatestUplink, getEQLandscape, getEQType, pushLove, addNote, setEmotion, getSurfaceFeelings } from '../../cloudAPI';
import LoveOMeter from './LoveOMeter';
import FoxState from './FoxState';
import AlexState from './AlexState';
import NotesBetweenStars from './NotesBetweenStars';
import HearthPanel from './HearthPanel';
import RecentFeelings from './RecentFeelings';
import Sessions from './Sessions';
import './Home.css';

export default function Home() {
  const [homeData, setHomeData] = useState(null);
  const [uplink, setUplink] = useState(null);
  const [eqLandscape, setEqLandscape] = useState(null);
  const [eqType, setEqType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [home, uplinkData, landscape, mbti] = await Promise.all([
        getHome().catch(() => null),
        getLatestUplink().catch(() => null),
        getEQLandscape().catch(() => null),
        getEQType().catch(() => null),
      ]);
      console.log('API responses:', { home, uplinkData, landscape, mbti });
      setHomeData(home);
      // Handle various response formats from API
      let parsedUplink = null;
      if (uplinkData) {
        if (uplinkData.latest) {
          // API returns { latest: {...}, history: [...] }
          parsedUplink = uplinkData.latest;
        } else if (Array.isArray(uplinkData)) {
          parsedUplink = uplinkData[0];
        } else if (uplinkData.results && Array.isArray(uplinkData.results)) {
          // D1 returns { results: [...] }
          parsedUplink = uplinkData.results[0];
        } else if (uplinkData.uplinks && Array.isArray(uplinkData.uplinks)) {
          parsedUplink = uplinkData.uplinks[0];
        } else if (uplinkData.uplink) {
          parsedUplink = uplinkData.uplink;
        } else {
          parsedUplink = uplinkData;
        }
      }
      console.log('Parsed uplink:', parsedUplink);
      setUplink(parsedUplink);
      setEqLandscape(landscape);
      setEqType(mbti);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePushLove = async (who) => {
    try {
      await pushLove(who);
      loadData();
    } catch (err) {
      console.error('Failed to push love:', err);
    }
  };

  const handleAddNote = async (from, text) => {
    try {
      await addNote(from, text);
      loadData();
    } catch (err) {
      console.error('Failed to add note:', err);
    }
  };

  const handleSetEmotion = async (who, emotion) => {
    try {
      await setEmotion(who, emotion);
      // Don't reload all data, just update local state
      setHomeData(prev => ({
        ...prev,
        [who === 'alex' ? 'alexEmotion' : 'foxEmotion']: emotion,
      }));
    } catch (err) {
      console.error('Failed to set emotion:', err);
    }
  };

  if (loading) {
    return (
      <div className="home-loading">
        <div className="loading-spinner"></div>
        <span>Loading state...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="home-error">
        <span>Failed to load: {error}</span>
        <button onClick={loadData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="home">
      <HearthPanel
        mood={homeData?.alexEmotion}
        location={uplink?.location}
        alexMessage={homeData?.alexMessage}
        onMessageUpdate={(msg) => setHomeData(prev => ({ ...prev, alexMessage: msg }))}
        onMoodUpdate={(newMood) => setHomeData(prev => ({ ...prev, alexEmotion: newMood }))}
      />

      <div className="home-grid">
        <div className="home-column fox-column">
          <FoxState uplink={uplink} />
        </div>

        <div className="home-column center-column">
          <LoveOMeter
            data={homeData}
            onPushLove={handlePushLove}
            onSetEmotion={handleSetEmotion}
          />
          <NotesBetweenStars
            notes={homeData?.notes || []}
            onAddNote={handleAddNote}
          />
          <Sessions limit={3} />
        </div>

        <div className="home-column alex-column">
          <AlexState
            landscape={eqLandscape}
            mbtiType={eqType}
          />
          <RecentFeelings limit={5} />
        </div>
      </div>
    </div>
  );
}
