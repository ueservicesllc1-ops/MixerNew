//
//  NextGenEngineBridge.h
//  ZionStageApple
//
//  Puente Objective-C++ que expone el motor C++ NextGenMultitrackEngine a Swift.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface NextGenEngineBridge : NSObject

- (instancetype)init;

- (void)loadSongWithStemsJson:(NSString *)stemsJson;
- (void)play;
- (void)pause;
- (void)stop;
- (void)seekToSeconds:(double)seconds;

- (void)setTrackVolumeWithId:(NSString *)trackId volume:(float)volume;
- (void)setTrackMuteWithId:(NSString *)trackId muted:(BOOL)muted;
- (void)setTrackSoloWithId:(NSString *)trackId solo:(BOOL)solo;
- (void)setTrackPanWithId:(NSString *)trackId pan:(float)pan;

- (void)setPitchSemiTones:(float)semitones;
- (void)setTempoRatio:(float)ratio;
- (void)setMasterVolume:(float)volume;

- (NSString *)getSnapshotJson;

@end

NS_ASSUME_NONNULL_END
