import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../src/generated/prisma/index.js');
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Helper function to hash passwords
async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

// Helper function to get random enum value
function getRandomEnumValue<T extends Record<string, string>>(enumObject: T): T[keyof T] {
  const values = Object.values(enumObject);
  return values[Math.floor(Math.random() * values.length)];
}

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clean existing data (in reverse order due to foreign key constraints)
  await prisma.aIUsage.deleteMany();
  await prisma.scriptureRef.deleteMany();
  await prisma.aIResponse.deleteMany();
  await prisma.mentorSession.deleteMany();
  await prisma.mentorship.deleteMany();
  await prisma.eventRsvp.deleteMany();
  await prisma.event.deleteMany();
  await prisma.streak.deleteMany();
  await prisma.xpEvent.deleteMany();
  await prisma.xpTotals.deleteMany();
  await prisma.prayerCommit.deleteMany();
  await prisma.prayer.deleteMany();
  await prisma.reaction.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.moderationAction.deleteMany();
  await prisma.magicLink.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.device.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.featureFlag.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleaned existing data');

  // Create feature flags
  const featureFlags = await Promise.all([
    prisma.featureFlag.create({
      data: {
        key: 'prayer_requests_enabled',
        enabled: true,
        payload: { maxDaily: 10 }
      }
    }),
    prisma.featureFlag.create({
      data: {
        key: 'ai_devotionals_enabled',
        enabled: true,
        payload: { maxDaily: 3, providers: ['openai', 'anthropic'] }
      }
    }),
    prisma.featureFlag.create({
      data: {
        key: 'group_creation_enabled',
        enabled: true,
        payload: { maxGroups: 5 }
      }
    }),
    prisma.featureFlag.create({
      data: {
        key: 'mentorship_program_enabled',
        enabled: false,
        payload: { beta: true }
      }
    })
  ]);

  console.log(`✅ Created ${featureFlags.length} feature flags`);

  // Create users
  const users = await Promise.all([
    // Admin user
    prisma.user.create({
      data: {
        email: 'admin@anointed.app',
        passwordHash: await hashPassword('SecurePass123!'),
        displayName: 'Pastor John',
        avatarUrl: faker.image.avatar(),
        tz: 'America/New_York',
        userSettings: {
          create: {
            bibleTranslation: 'ESV',
            denomination: 'Baptist',
            quietTimeStart: '06:00',
            quietTimeEnd: '07:00',
            pushOptIn: true
          }
        }
      }
    }),
    // Regular users
    ...Array.from({ length: 20 }, async () => {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      return prisma.user.create({
        data: {
          email: faker.internet.email({ firstName, lastName }),
          passwordHash: await hashPassword('Password123!'),
          displayName: `${firstName} ${lastName}`,
          avatarUrl: faker.image.avatar(),
          tz: faker.location.timeZone(),
          userSettings: {
            create: {
              bibleTranslation: faker.helpers.arrayElement(['NIV', 'ESV', 'NASB', 'NLT', 'MSG']),
              denomination: faker.helpers.arrayElement(['Baptist', 'Methodist', 'Presbyterian', 'Catholic', 'Pentecostal', 'Non-denominational']),
              quietTimeStart: faker.helpers.arrayElement(['05:30', '06:00', '06:30', '07:00', '07:30']),
              quietTimeEnd: faker.helpers.arrayElement(['06:30', '07:00', '07:30', '08:00', '08:30']),
              pushOptIn: faker.datatype.boolean({ probability: 0.8 })
            }
          }
        }
      });
    })
  ]);

  console.log(`✅ Created ${users.length} users`);

  // Create devices for users
  const devices = [];
  for (const user of users.slice(0, 15)) { // Only some users have devices
    const deviceCount = faker.number.int({ min: 1, max: 3 });
    for (let i = 0; i < deviceCount; i++) {
      const device = await prisma.device.create({
        data: {
          userId: user.id,
          platform: faker.helpers.arrayElement(['ios', 'android', 'web']),
          pushToken: faker.string.alphanumeric(64),
          lastSeenAt: faker.date.recent({ days: 7 })
        }
      });
      devices.push(device);
    }
  }

  console.log(`✅ Created ${devices.length} devices`);

  // Create groups
  const groups = await Promise.all([
    prisma.group.create({
      data: {
        name: 'Young Adults Ministry',
        description: 'A community for young adults (18-35) to grow in faith together',
        privacy: 'PUBLIC',
        createdBy: users[0].id
      }
    }),
    prisma.group.create({
      data: {
        name: 'Bible Study Fellowship',
        description: 'Weekly Bible study focusing on deep scripture exploration',
        privacy: 'PUBLIC',
        createdBy: users[1].id
      }
    }),
    prisma.group.create({
      data: {
        name: 'Prayer Warriors',
        description: 'Dedicated to intercessory prayer and spiritual warfare',
        privacy: 'PRIVATE',
        createdBy: users[2].id
      }
    }),
    prisma.group.create({
      data: {
        name: 'Family Ministry',
        description: 'Supporting families in their faith journey',
        privacy: 'PUBLIC',
        createdBy: users[3].id
      }
    }),
    prisma.group.create({
      data: {
        name: 'Worship Team',
        description: 'Musicians and vocalists leading worship',
        privacy: 'PRIVATE',
        createdBy: users[4].id
      }
    })
  ]);

  console.log(`✅ Created ${groups.length} groups`);

  // Create group memberships
  const groupMemberships = [];
  for (const group of groups) {
    // Add creator as admin
    await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId: group.createdBy,
        role: 'ADMIN'
      }
    });

    // Add random members
    const memberCount = faker.number.int({ min: 5, max: 15 });
    const randomUsers = faker.helpers.arrayElements(
      users.filter(u => u.id !== group.createdBy),
      memberCount
    );

    for (const user of randomUsers) {
      const membership = await prisma.groupMember.create({
        data: {
          groupId: group.id,
          userId: user.id,
          role: faker.helpers.arrayElement(['MEMBER', 'MODERATOR'])
        }
      });
      groupMemberships.push(membership);
    }
  }

  console.log(`✅ Created ${groupMemberships.length + groups.length} group memberships`);

  // Create posts
  const posts = [];
  for (let i = 0; i < 50; i++) {
    const randomUser = faker.helpers.arrayElement(users);
    const randomGroup = faker.datatype.boolean({ probability: 0.6 }) 
      ? faker.helpers.arrayElement(groups) 
      : null;

    const post = await prisma.post.create({
      data: {
        userId: randomUser.id,
        groupId: randomGroup?.id,
        type: faker.helpers.arrayElement(['POST', 'TESTIMONY']),
        content: faker.lorem.paragraphs(faker.number.int({ min: 1, max: 3 })),
        mediaUrls: faker.datatype.boolean({ probability: 0.3 }) 
          ? [faker.image.url(), faker.image.url()] 
          : null,
        status: 'ACTIVE',
        createdAt: faker.date.recent({ days: 30 })
      }
    });
    posts.push(post);
  }

  console.log(`✅ Created ${posts.length} posts`);

  // Create comments
  const comments = [];
  for (let i = 0; i < 150; i++) {
    const randomPost = faker.helpers.arrayElement(posts);
    const randomUser = faker.helpers.arrayElement(users);

    const comment = await prisma.comment.create({
      data: {
        postId: randomPost.id,
        userId: randomUser.id,
        content: faker.lorem.sentences(faker.number.int({ min: 1, max: 3 })),
        createdAt: faker.date.between({
          from: randomPost.createdAt,
          to: new Date()
        })
      }
    });
    comments.push(comment);
  }

  console.log(`✅ Created ${comments.length} comments`);

  // Create reactions
  const reactions = [];
  for (let i = 0; i < 200; i++) {
    const randomPost = faker.helpers.arrayElement(posts);
    const randomUser = faker.helpers.arrayElement(users);

    try {
      const reaction = await prisma.reaction.create({
        data: {
          postId: randomPost.id,
          userId: randomUser.id,
          type: faker.helpers.arrayElement(['LIKE', 'AMEN', 'PRAYER']),
          createdAt: faker.date.between({
            from: randomPost.createdAt,
            to: new Date()
          })
        }
      });
      reactions.push(reaction);
    } catch (error) {
      // Skip if unique constraint violation (user already reacted with this type)
    }
  }

  console.log(`✅ Created ${reactions.length} reactions`);

  // Create prayers
  const prayers = [];
  for (let i = 0; i < 30; i++) {
    const randomUser = faker.helpers.arrayElement(users);
    const randomGroup = faker.datatype.boolean({ probability: 0.4 }) 
      ? faker.helpers.arrayElement(groups) 
      : null;

    const prayer = await prisma.prayer.create({
      data: {
        userId: randomUser.id,
        groupId: randomGroup?.id,
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraphs(2),
        status: faker.helpers.arrayElement(['OPEN', 'ANSWERED', 'ARCHIVED']),
        createdAt: faker.date.recent({ days: 60 })
      }
    });
    prayers.push(prayer);
  }

  console.log(`✅ Created ${prayers.length} prayers`);

  // Create prayer commits
  const prayerCommits = [];
  for (const prayer of prayers) {
    const commitCount = faker.number.int({ min: 1, max: 10 });
    const randomUsers = faker.helpers.arrayElements(users, commitCount);

    for (const user of randomUsers) {
      const commit = await prisma.prayerCommit.create({
        data: {
          prayerId: prayer.id,
          userId: user.id,
          message: faker.datatype.boolean({ probability: 0.7 }) 
            ? faker.lorem.sentence() 
            : null,
          createdAt: faker.date.between({
            from: prayer.createdAt,
            to: new Date()
          })
        }
      });
      prayerCommits.push(commit);
    }
  }

  console.log(`✅ Created ${prayerCommits.length} prayer commits`);

  // Create XP events and totals
  const xpEvents = [];
  const fruits = ['LOVE', 'JOY', 'PEACE', 'PATIENCE', 'KINDNESS', 'GOODNESS', 'FAITHFULNESS', 'GENTLENESS', 'SELF_CONTROL'];
  
  for (const user of users) {
    // Create XP totals for user
    const xpTotals = {
      love: 0, joy: 0, peace: 0, patience: 0, kindness: 0,
      goodness: 0, faithfulness: 0, gentleness: 0, selfControl: 0
    };

    // Create random XP events for past 30 days
    const eventCount = faker.number.int({ min: 10, max: 50 });
    for (let i = 0; i < eventCount; i++) {
      const fruit = faker.helpers.arrayElement(fruits);
      const amount = faker.number.int({ min: 5, max: 25 });
      
      const xpEvent = await prisma.xpEvent.create({
        data: {
          userId: user.id,
          fruit: fruit as any,
          amount,
          reason: faker.helpers.arrayElement([
            'Daily prayer completed',
            'Scripture reading',
            'Helped community member',
            'Shared testimony',
            'Attended group meeting',
            'Completed devotional'
          ]),
          metadata: { source: 'daily_activity' },
          createdAt: faker.date.recent({ days: 30 })
        }
      });
      xpEvents.push(xpEvent);

      // Update totals
      const fruitKey = fruit.toLowerCase().replace('_', '') as keyof typeof xpTotals;
      if (fruitKey === 'selfcontrol') {
        xpTotals.selfControl += amount;
      } else {
        xpTotals[fruitKey as keyof Omit<typeof xpTotals, 'selfControl'>] += amount;
      }
    }

    await prisma.xpTotals.create({
      data: {
        userId: user.id,
        ...xpTotals
      }
    });
  }

  console.log(`✅ Created ${xpEvents.length} XP events and ${users.length} XP totals`);

  // Create streaks
  const streaks = [];
  const streakKinds = ['PRAYER', 'SCRIPTURE', 'WELLNESS'];
  for (const user of users.slice(0, 15)) { // Only some users have streaks
    for (const kind of streakKinds) {
      if (faker.datatype.boolean({ probability: 0.6 })) {
        const current = faker.number.int({ min: 0, max: 30 });
        const longest = faker.number.int({ min: current, max: 100 });
        
        const streak = await prisma.streak.create({
          data: {
            userId: user.id,
            kind: kind as any,
            current,
            longest,
            lastAt: current > 0 ? faker.date.recent({ days: 1 }) : null
          }
        });
        streaks.push(streak);
      }
    }
  }

  console.log(`✅ Created ${streaks.length} streaks`);

  // Create AI responses
  const aiResponses = [];
  for (let i = 0; i < 25; i++) {
    const randomUser = faker.helpers.arrayElement(users);
    const kind = faker.helpers.arrayElement(['DEVOTIONAL', 'PRAYER']);
    
    const aiResponse = await prisma.aIResponse.create({
      data: {
        userId: randomUser.id,
        kind: kind as any,
        prompt: {
          topic: faker.lorem.words(3),
          context: faker.lorem.sentence()
        },
        output: faker.lorem.paragraphs(3),
        allowed: faker.datatype.boolean({ probability: 0.95 }),
        templateVersion: faker.system.semver(),
        latencyMs: faker.number.int({ min: 500, max: 3000 }),
        costUsd: faker.number.float({ min: 0.001, max: 0.05, fractionDigits: 4 }),
        createdAt: faker.date.recent({ days: 14 })
      }
    });
    aiResponses.push(aiResponse);
  }

  console.log(`✅ Created ${aiResponses.length} AI responses`);

  // Create scripture references for AI responses
  const scriptureRefs = [];
  for (const response of aiResponses.slice(0, 15)) { // Some responses have scripture refs
    const refCount = faker.number.int({ min: 1, max: 3 });
    for (let i = 0; i < refCount; i++) {
      const scriptureRef = await prisma.scriptureRef.create({
        data: {
          aiResponseId: response.id,
          book: faker.helpers.arrayElement([
            'Genesis', 'Exodus', 'Psalms', 'Proverbs', 'Matthew', 
            'John', 'Romans', 'Ephesians', 'Philippians', 'Revelation'
          ]),
          chapter: faker.number.int({ min: 1, max: 50 }),
          verseStart: faker.number.int({ min: 1, max: 25 }),
          verseEnd: faker.number.int({ min: 1, max: 30 })
        }
      });
      scriptureRefs.push(scriptureRef);
    }
  }

  console.log(`✅ Created ${scriptureRefs.length} scripture references`);

  // Create events
  const events = [];
  for (let i = 0; i < 10; i++) {
    const randomUser = faker.helpers.arrayElement(users);
    const randomGroup = faker.datatype.boolean({ probability: 0.6 }) 
      ? faker.helpers.arrayElement(groups) 
      : null;

    const startsAt = faker.date.future();
    const event = await prisma.event.create({
      data: {
        title: faker.helpers.arrayElement([
          'Sunday Service', 'Bible Study', 'Prayer Meeting', 'Youth Group',
          'Women\'s Fellowship', 'Men\'s Breakfast', 'Worship Night'
        ]),
        description: faker.lorem.paragraph(),
        startsAt,
        endsAt: new Date(startsAt.getTime() + (2 * 60 * 60 * 1000)), // 2 hours later
        location: faker.location.streetAddress(),
        visibility: randomGroup ? 'GROUP' : 'PUBLIC',
        groupId: randomGroup?.id,
        createdBy: randomUser.id
      }
    });
    events.push(event);
  }

  console.log(`✅ Created ${events.length} events`);

  // Create event RSVPs
  const eventRsvps = [];
  for (const event of events) {
    const rsvpCount = faker.number.int({ min: 3, max: 12 });
    const randomUsers = faker.helpers.arrayElements(users, rsvpCount);

    for (const user of randomUsers) {
      try {
        const rsvp = await prisma.eventRsvp.create({
          data: {
            eventId: event.id,
            userId: user.id,
            status: faker.helpers.arrayElement(['GOING', 'INTERESTED', 'DECLINED'])
          }
        });
        eventRsvps.push(rsvp);
      } catch (error) {
        // Skip if unique constraint violation
      }
    }
  }

  console.log(`✅ Created ${eventRsvps.length} event RSVPs`);

  // Create mentorships
  const mentorships = [];
  for (let i = 0; i < 8; i++) {
    const mentor = faker.helpers.arrayElement(users.slice(0, 10)); // First 10 users can be mentors
    const mentee = faker.helpers.arrayElement(users.slice(10)); // Rest can be mentees

    try {
      const mentorship = await prisma.mentorship.create({
        data: {
          mentorId: mentor.id,
          menteeId: mentee.id,
          status: faker.helpers.arrayElement(['ACTIVE', 'PAUSED', 'COMPLETED']),
          startedAt: faker.date.past()
        }
      });
      mentorships.push(mentorship);
    } catch (error) {
      // Skip if unique constraint violation
    }
  }

  console.log(`✅ Created ${mentorships.length} mentorships`);

  // Create mentor sessions
  const mentorSessions = [];
  for (const mentorship of mentorships) {
    const sessionCount = faker.number.int({ min: 1, max: 6 });
    for (let i = 0; i < sessionCount; i++) {
      const scheduledAt = faker.date.between({
        from: mentorship.startedAt,
        to: new Date()
      });
      
      const session = await prisma.mentorSession.create({
        data: {
          mentorshipId: mentorship.id,
          scheduledAt,
          notes: faker.datatype.boolean({ probability: 0.8 }) 
            ? faker.lorem.paragraph() 
            : null,
          completedAt: faker.datatype.boolean({ probability: 0.7 }) 
            ? faker.date.between({ from: scheduledAt, to: new Date() })
            : null
        }
      });
      mentorSessions.push(session);
    }
  }

  console.log(`✅ Created ${mentorSessions.length} mentor sessions`);

  // Create notifications
  const notifications = [];
  for (const user of users.slice(0, 15)) { // Some users have notifications
    const notificationCount = faker.number.int({ min: 2, max: 8 });
    for (let i = 0; i < notificationCount; i++) {
      const notification = await prisma.notification.create({
        data: {
          userId: user.id,
          type: faker.helpers.arrayElement([
            'prayer_request', 'mention', 'group_invite', 'event_reminder', 
            'comment', 'reaction', 'mentorship_request'
          ]),
          payload: {
            title: faker.lorem.sentence(),
            message: faker.lorem.sentence(),
            actionUrl: '/app/feed'
          },
          read: faker.datatype.boolean({ probability: 0.6 }),
          createdAt: faker.date.recent({ days: 7 })
        }
      });
      notifications.push(notification);
    }
  }

  console.log(`✅ Created ${notifications.length} notifications`);

  // Create some sample moderation actions and audit logs
  const moderationActions = [];
  for (let i = 0; i < 5; i++) {
    const randomPost = faker.helpers.arrayElement(posts);
    const moderator = users[0]; // Admin user as moderator

    const action = await prisma.moderationAction.create({
      data: {
        entityType: 'post',
        entityId: randomPost.id,
        actorId: moderator.id,
        action: faker.helpers.arrayElement(['APPROVE', 'REJECT']),
        notes: faker.lorem.sentence(),
        createdAt: faker.date.recent({ days: 30 })
      }
    });
    moderationActions.push(action);
  }

  console.log(`✅ Created ${moderationActions.length} moderation actions`);

  // Create audit logs
  const auditLogs = [];
  for (let i = 0; i < 20; i++) {
    const randomUser = faker.datatype.boolean({ probability: 0.8 }) 
      ? faker.helpers.arrayElement(users) 
      : null;

    const auditLog = await prisma.auditLog.create({
      data: {
        userId: randomUser?.id,
        action: faker.helpers.arrayElement([
          'user_created', 'user_updated', 'post_created', 'group_joined',
          'prayer_submitted', 'event_created', 'system_maintenance'
        ]),
        entityType: faker.helpers.arrayElement(['user', 'post', 'group', 'prayer', 'event']),
        entityId: faker.string.uuid(),
        metadata: {
          source: faker.helpers.arrayElement(['web', 'mobile', 'api', 'system']),
          userAgent: faker.internet.userAgent()
        },
        createdAt: faker.date.recent({ days: 30 })
      }
    });
    auditLogs.push(auditLog);
  }

  console.log(`✅ Created ${auditLogs.length} audit logs`);

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`  • ${users.length} users`);
  console.log(`  • ${groups.length} groups`);
  console.log(`  • ${posts.length} posts`);
  console.log(`  • ${comments.length} comments`);
  console.log(`  • ${reactions.length} reactions`);
  console.log(`  • ${prayers.length} prayers`);
  console.log(`  • ${prayerCommits.length} prayer commits`);
  console.log(`  • ${xpEvents.length} XP events`);
  console.log(`  • ${streaks.length} streaks`);
  console.log(`  • ${aiResponses.length} AI responses`);
  console.log(`  • ${events.length} events`);
  console.log(`  • ${mentorships.length} mentorships`);
  console.log(`  • ${notifications.length} notifications`);
  console.log(`  • ${featureFlags.length} feature flags`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
