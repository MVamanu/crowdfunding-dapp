/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/crowdfunding.json`.
 */
export type Crowdfunding = {
  "address": "9Q26M3XJE9pveumjKK4VxMfBu8EQXPnqHHTNXfSU5kEi",
  "metadata": {
    "name": "crowdfunding",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Crowdfunding smart contract on Solana"
  },
  "instructions": [
    {
      "name": "createCampaign",
      "discriminator": [
        111,
        131,
        187,
        98,
        160,
        193,
        114,
        244
      ],
      "accounts": [
        {
          "name": "campaign",
          "writable": true,
          "signer": true
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "description",
          "type": "string"
        },
        {
          "name": "goal",
          "type": "u64"
        }
      ]
    },
    {
      "name": "createMilestoneCampaign",
      "discriminator": [
        145,
        252,
        198,
        184,
        51,
        192,
        131,
        151
      ],
      "accounts": [
        {
          "name": "milestoneCampaign",
          "writable": true,
          "signer": true
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "description",
          "type": "string"
        },
        {
          "name": "milestoneTitles",
          "type": {
            "vec": "string"
          }
        },
        {
          "name": "milestoneDescriptions",
          "type": {
            "vec": "string"
          }
        },
        {
          "name": "milestoneAmounts",
          "type": {
            "vec": "u64"
          }
        }
      ]
    },
    {
      "name": "donate",
      "discriminator": [
        121,
        186,
        218,
        211,
        73,
        70,
        196,
        180
      ],
      "accounts": [
        {
          "name": "campaign",
          "writable": true
        },
        {
          "name": "donor",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "donateMilestone",
      "discriminator": [
        228,
        138,
        50,
        213,
        136,
        128,
        75,
        231
      ],
      "accounts": [
        {
          "name": "milestoneCampaign",
          "writable": true
        },
        {
          "name": "donor",
          "writable": true,
          "signer": true
        },
        {
          "name": "donorAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  111,
                  110,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "milestoneCampaign"
              },
              {
                "kind": "account",
                "path": "donor"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "finalizeMilestone",
      "discriminator": [
        7,
        134,
        89,
        13,
        34,
        31,
        108,
        149
      ],
      "accounts": [
        {
          "name": "milestoneCampaign",
          "writable": true
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "milestoneIdx",
          "type": "u8"
        }
      ]
    },
    {
      "name": "submitMilestone",
      "discriminator": [
        35,
        96,
        220,
        215,
        102,
        83,
        139,
        52
      ],
      "accounts": [
        {
          "name": "milestoneCampaign",
          "writable": true
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "voteMilestone",
      "discriminator": [
        43,
        27,
        71,
        239,
        231,
        20,
        102,
        156
      ],
      "accounts": [
        {
          "name": "milestoneCampaign",
          "writable": true
        },
        {
          "name": "voter",
          "writable": true,
          "signer": true
        },
        {
          "name": "donorAccount",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  111,
                  110,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "milestoneCampaign"
              },
              {
                "kind": "account",
                "path": "voter"
              }
            ]
          }
        },
        {
          "name": "voteRecord",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "milestoneIdx",
          "type": "u8"
        },
        {
          "name": "approve",
          "type": "bool"
        }
      ]
    },
    {
      "name": "withdraw",
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "campaign",
          "writable": true
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "campaign",
      "discriminator": [
        50,
        40,
        49,
        11,
        157,
        220,
        229,
        192
      ]
    },
    {
      "name": "donorRecord",
      "discriminator": [
        204,
        101,
        15,
        37,
        82,
        141,
        165,
        40
      ]
    },
    {
      "name": "milestoneCampaign",
      "discriminator": [
        124,
        165,
        47,
        161,
        231,
        189,
        12,
        12
      ]
    },
    {
      "name": "voteRecord",
      "discriminator": [
        112,
        9,
        123,
        165,
        234,
        9,
        157,
        167
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "campaignInactive",
      "msg": "Campania nu este activa"
    },
    {
      "code": 6001,
      "name": "unauthorized",
      "msg": "Nu esti proprietarul campaniei"
    },
    {
      "code": 6002,
      "name": "goalNotReached",
      "msg": "Obiectivul nu a fost atins"
    },
    {
      "code": 6003,
      "name": "tooFewMilestones",
      "msg": "Minim 2 milestone-uri necesare"
    },
    {
      "code": 6004,
      "name": "tooManyMilestones",
      "msg": "Maxim 5 milestone-uri permise"
    },
    {
      "code": 6005,
      "name": "invalidData",
      "msg": "Date invalide"
    },
    {
      "code": 6006,
      "name": "votingAlreadyActive",
      "msg": "Votul este deja activ"
    },
    {
      "code": 6007,
      "name": "milestoneAlreadyCompleted",
      "msg": "Milestone deja completat"
    },
    {
      "code": 6008,
      "name": "notADonor",
      "msg": "Trebuie sa fii donator"
    },
    {
      "code": 6009,
      "name": "alreadyVoted",
      "msg": "Ai votat deja"
    },
    {
      "code": 6010,
      "name": "votingNotActive",
      "msg": "Votul nu este activ"
    },
    {
      "code": 6011,
      "name": "votingExpired",
      "msg": "Votul a expirat"
    }
  ],
  "types": [
    {
      "name": "campaign",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "goal",
            "type": "u64"
          },
          {
            "name": "amountRaised",
            "type": "u64"
          },
          {
            "name": "isActive",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "donorRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "campaign",
            "type": "pubkey"
          },
          {
            "name": "donor",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "milestone",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "completed",
            "type": "bool"
          },
          {
            "name": "approved",
            "type": "bool"
          },
          {
            "name": "votesFor",
            "type": "u64"
          },
          {
            "name": "votesAgainst",
            "type": "u64"
          },
          {
            "name": "votingActive",
            "type": "bool"
          },
          {
            "name": "votingDeadline",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "milestoneCampaign",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "totalGoal",
            "type": "u64"
          },
          {
            "name": "amountRaised",
            "type": "u64"
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "currentMilestone",
            "type": "u8"
          },
          {
            "name": "milestoneCount",
            "type": "u8"
          },
          {
            "name": "milestones",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "milestone"
                  }
                },
                5
              ]
            }
          }
        ]
      }
    },
    {
      "name": "voteRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "voter",
            "type": "pubkey"
          },
          {
            "name": "campaign",
            "type": "pubkey"
          },
          {
            "name": "milestoneIdx",
            "type": "u8"
          },
          {
            "name": "hasVoted",
            "type": "bool"
          }
        ]
      }
    }
  ]
};
