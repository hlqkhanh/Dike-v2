package com.dike.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.dike.identity.application.AccountAccessService;
import com.dike.identity.application.IdentityStore;
import com.dike.identity.application.ProfileDataStore;
import com.dike.identity.domain.UserAccount;
import com.dike.identity.domain.UserProfile;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class IdentityAccessTest {
  private final ProfileDataStore profiles = mock(ProfileDataStore.class);
  private final IdentityStore identities = mock(IdentityStore.class);
  private final IdentityAccess access =
      new IdentityAccess(mock(AccountAccessService.class), profiles, identities);

  @Test
  void profileNameAndUploadedAvatarTakePrecedenceOverLoginIdentity() {
    var profile = mock(UserProfile.class);
    when(profiles.findProfile("member")).thenReturn(Optional.of(profile));
    when(profile.displayName()).thenReturn("Updated member name");
    when(profile.avatarPublicUrl()).thenReturn("https://images.example/uploaded.png");

    assertThat(access.displayName("member")).isEqualTo("Updated member name");
    assertThat(access.avatarUrl("member")).isEqualTo("https://images.example/uploaded.png");
    verifyNoInteractions(identities);
  }

  @Test
  void memberWithoutProfileUsesRealLoginNameAndAvatar() {
    var account = mock(UserAccount.class);
    when(identities.findUserById("member")).thenReturn(Optional.of(account));
    when(account.displayName()).thenReturn("Login member name");
    when(account.avatarUrl()).thenReturn("https://images.example/google.png");

    assertThat(access.displayName("member")).isEqualTo("Login member name");
    assertThat(access.avatarUrl("member")).isEqualTo("https://images.example/google.png");
  }

  @Test
  void blankProfileFieldsFallBackToLoginIdentity() {
    var profile = mock(UserProfile.class);
    var account = mock(UserAccount.class);
    when(profiles.findProfile("member")).thenReturn(Optional.of(profile));
    when(profile.displayName()).thenReturn(" ");
    when(profile.avatarPublicUrl()).thenReturn(" ");
    when(identities.findUserById("member")).thenReturn(Optional.of(account));
    when(account.displayName()).thenReturn("Login member name");
    when(account.avatarUrl()).thenReturn("https://images.example/google.png");

    assertThat(access.displayName("member")).isEqualTo("Login member name");
    assertThat(access.avatarUrl("member")).isEqualTo("https://images.example/google.png");
  }

  @Test
  void samplePostWithoutIdentityKeepsPlaceholderAndNoPhoto() {
    assertThat(access.displayName("demo-user-missing")).isEqualTo("Thành viên Diké");
    assertThat(access.avatarUrl("demo-user-missing")).isNull();
  }
}
