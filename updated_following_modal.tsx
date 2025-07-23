      {showFollowingModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between p-4">
            <h3 className="text-2xl font-bold text-primary logo-text-glow">Following</h3>
            <button className="text-white text-lg font-bold" onClick={() => setShowFollowingModal(false)}>Close</button>
          </div>
          <div className="flex-1 px-4 pt-4 pb-8 overflow-y-auto">
            <div className="w-full max-w-md mx-auto space-y-4">
              {loadingFollowing ? (
                <div className="text-white text-center">Loading...</div>
              ) : following.length === 0 ? (
                <div className="text-white text-center">Not following anyone yet</div>
              ) : following.map((f) => (
                <div key={f.user_id} className="flex items-center justify-between bg-black/80 rounded-lg p-3">
                  <div 
                    className="flex items-center gap-3 cursor-pointer" 
                    onClick={() => {
                      setShowFollowingModal(false);
                      navigate(`/profile/${f.username}`);
                    }}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={f.avatar_url || undefined} alt={f.username} />
                      <AvatarFallback>{f.username?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-white font-semibold">{f.display_name || f.username}</span>
                      <span className="text-gray-400 text-sm">@{f.username}</span>
                    </div>
                  </div>
                  <button
                    className={clsx("text-red-500 font-bold ml-4", removingId === f.user_id && "opacity-50 pointer-events-none")}
                    onClick={() => handleRemoveFollowing(f.user_id)}
                    disabled={removingId === f.user_id}
                  >Remove</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}