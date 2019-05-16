---
title: "[빠른커맨드] Docker 이미지 및 컨테이너 관리"
date: "2019-05-07"
template: "post"
draft: false
slug: "/posts/system/docker-ps-command"
category: "System"
tags:
  - "Docker"
  - "Docker Compose"
  - "Docker Container"
  - "Docker Command"
  - "System"
description: "Docker Container 이미지 / 컨테이너 관리 명령어"
---


## Introduction

Docker / Docker Compose 관련 명령어 중, 간혹 사용되는 명령어드를 빠르게 찾을 수 있도록 한다.


## 사용되지 않는 리소스의 삭제

Docker에서 종료된 컨테이너, 사용되지 않는 이미지/네트워크를 삭제하기 위해서는 다음 명령어를 사용한다.

```
$ docker system prune
```

*--volume* 혹은 *-v* 옵션을 통해 Docker 볼륨을 함께 제거할 수 있다. 

## 종료된 컨테이너 삭제 

Docker Container는 종료되어도 자동으로 제거되지 않는다. 특히 Port 등의 요소가 Binding 되면 다른 프로세스에서는 사용할 수 없다. 

종료된 Container를 제거하기 위해서는 다음 명령어를 사용한다. 

```
$ docker rm $(docker ps -aq)
```

## 캐시 이미지의 삭제

Docker 캐시 이미지들을 삭제 하기 위해서는 다음 명렁어를 사용한다.

```
$ docker rmi $(docker images -aq)
```

주의해야 하는 점은, 이미지 제거 전에, 모든 Container가 정지(Stopped) 상태여야 한다. 
