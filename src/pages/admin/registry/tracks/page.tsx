import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminTable } from "@/components/design-system/admin/AdminTable";
import { supabase } from '@/lib/supabase';

export default function TracksPage() {
  const [tracks, setTracks] = useState([]);

  useEffect(() => {
    async function fetchTracks() {
      const { data } = await supabase.from('registry_tracks').select('*');
      setTracks(data);
    }
    fetchTracks();
  }, []);

  return (
    <div>
      <h1>Track Registry</h1>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Primary Artist</th>
            <th>Duration</th>
            <th>Release</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tracks.map(track => (
            <tr key={track.id}>
              <td>{track.title}</td>
              <td>{track.primary_artist_name}</td>
              <td>{track.duration}</td>
              <td>{track.release_name}</td>
              <td>{track.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
