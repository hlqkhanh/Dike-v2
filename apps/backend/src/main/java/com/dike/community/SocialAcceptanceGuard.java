package com.dike.community;

import com.dike.community.domain.SocialRelation;
import com.dike.shared.application.AtomicCommands;
import java.time.Instant;
import org.springframework.stereotype.Service;

@Service
public class SocialAcceptanceGuard {
  private final AtomicCommands commands;

  public SocialAcceptanceGuard(AtomicCommands commands) {
    this.commands = commands;
  }

  public void fence(String a, String b) {
    commands.fence("social", SocialRelation.empty(a, b, Instant.EPOCH).id());
  }
}
